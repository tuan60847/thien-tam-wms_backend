import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service.js';
import { RefreshTokenService } from '../auth/refresh-token/refresh-token.service.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RolesService } from '../roles/roles.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { QueryUserDto } from './dto/query-user.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import { toUserResponse } from './users.mapper.js';

export type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

const BCRYPT_COST = 10;
const SORT_WHITELIST = ['maNV', 'username', 'hoTen', 'createdAt'] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
  ) {}

  // ---- lookups used by AuthService --------------------------------------

  findByUsername(username: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });
  }

  findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  // ---- admin API -------------------------------------------------------

  findAll(query: QueryUserDto): Promise<PagedResponse<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      roleId: query.roleId,
      trangThai: query.trangThai,
      OR: query.q
        ? [
            { maNV: { contains: query.q } },
            { username: { contains: query.q } },
            { hoTen: { contains: query.q } },
            { email: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'maNV', direction: 'asc' },
      ]),
    ) as Prisma.UserOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.user.findMany({
          where,
          orderBy,
          skip,
          take,
          include: { role: true },
        }),
      count: () => this.prisma.user.count({ where }),
      map: toUserResponse,
    });
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return toUserResponse(await this.getOrThrow(id));
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertUsernameFree(dto.username, tx);
      if (dto.email) {
        await this.assertEmailFree(dto.email, tx);
      }
      const role = await this.roles.assertAssignable(dto.roleId, tx);
      const maNV = await this.codes.next(CODE.NHAN_VIEN, tx);

      const user = await tx.user.create({
        data: {
          maNV,
          username: dto.username,
          password: passwordHash,
          hoTen: dto.hoTen,
          email: dto.email ?? null,
          roleId: role.id,
        },
        include: { role: true },
      });
      await this.audit.record(
        {
          hanhDong: 'user.create',
          doiTuong: 'user',
          doiTuongId: user.id,
          sau: { maNV, username: user.username, roleMa: role.maRole },
        },
        tx,
      );
      return user;
    });

    return toUserResponse(created);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Must be the FIRST statement: it serialises user updates before the
      // transaction takes its read snapshot, so the admin count below sees the
      // result of any concurrent update that committed while we waited.
      await tx.$queryRaw`SELECT id FROM role WHERE ma_role = ${ROLE.ADMIN} FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!current) {
        throw new AppException('USER_NOT_FOUND');
      }

      const roleChanged =
        dto.roleId !== undefined && dto.roleId !== current.roleId;
      const locking = dto.trangThai === false && current.trangThai;
      const unlocking = dto.trangThai === true && !current.trangThai;

      if (id === actor.id && (roleChanged || locking)) {
        throw new AppException('USER_CANNOT_MODIFY_SELF');
      }

      if (dto.email && dto.email !== current.email) {
        await this.assertEmailFree(dto.email, tx, id);
      }
      const newRole = roleChanged
        ? await this.roles.assertAssignable(dto.roleId!, tx)
        : current.role;

      await this.assertAdminRemains(tx, current, {
        trangThai: dto.trangThai ?? current.trangThai,
        role: newRole,
      });

      const user = await tx.user.update({
        where: { id },
        data: {
          hoTen: dto.hoTen,
          email: dto.email,
          roleId: roleChanged ? dto.roleId : undefined,
          trangThai: dto.trangThai,
        },
        include: { role: true },
      });

      if (roleChanged) {
        await this.audit.record(
          {
            hanhDong: 'user.role_change',
            doiTuong: 'user',
            doiTuongId: id,
            truoc: { roleMa: current.role?.maRole ?? null },
            sau: { roleMa: newRole?.maRole ?? null },
          },
          tx,
        );
      }
      if (locking || unlocking) {
        await this.audit.record(
          {
            hanhDong: locking ? 'user.lock' : 'user.unlock',
            doiTuong: 'user',
            doiTuongId: id,
          },
          tx,
        );
      }
      // The old role/lock state must not survive in an already-issued session.
      if (roleChanged || locking) {
        await this.refreshTokens.revokeAllForUser(id, tx);
      }
      return user;
    });

    return toUserResponse(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<void> {
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) {
        throw new AppException('USER_NOT_FOUND');
      }
      await tx.user.update({ where: { id }, data: { password: passwordHash } });
      await this.refreshTokens.revokeAllForUser(id, tx);
      // Never log the password or its hash.
      await this.audit.record(
        { hanhDong: 'user.password_reset', doiTuong: 'user', doiTuongId: id },
        tx,
      );
    });
  }

  // ---- self-service ----------------------------------------------------

  async updateOwnProfile(
    actor: AuthenticatedUser,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.email) {
        await this.assertEmailFree(dto.email, tx, actor.id);
      }
      return tx.user.update({
        where: { id: actor.id },
        data: { hoTen: dto.hoTen, email: dto.email },
        include: { role: true },
      });
    });
    return toUserResponse(user);
  }

  async changeOwnPassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (dto.oldPassword === dto.newPassword) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          {
            field: 'newPassword',
            messages: ['Mật khẩu mới phải khác mật khẩu hiện tại'],
          },
        ],
      });
    }
    const user = await this.getOrThrow(actor.id);
    if (!(await bcrypt.compare(dto.oldPassword, user.password))) {
      throw new AppException('USER_OLD_PASSWORD_WRONG');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { password: passwordHash },
      });
      // Signs the user out everywhere; they log in again with the new password.
      await this.refreshTokens.revokeAllForUser(actor.id, tx);
    });
  }

  // ---- helpers ----------------------------------------------------------

  private async getOrThrow(id: string): Promise<UserWithRole> {
    const user = await this.findById(id);
    if (!user) {
      throw new AppException('USER_NOT_FOUND');
    }
    return user;
  }

  private async assertUsernameFree(
    username: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (await tx.user.findUnique({ where: { username } })) {
      throw new AppException('USER_USERNAME_TAKEN');
    }
  }

  private async assertEmailFree(
    email: string,
    tx: Prisma.TransactionClient,
    exceptUserId?: string,
  ): Promise<void> {
    const other = await tx.user.findUnique({ where: { email } });
    if (other && other.id !== exceptUserId) {
      throw new AppException('USER_EMAIL_TAKEN');
    }
  }

  // At least one active ADMIN (with an active ADMIN role) must always remain.
  // Concurrency is handled by the ADMIN role row lock taken at the start of update().
  private async assertAdminRemains(
    tx: Prisma.TransactionClient,
    current: UserWithRole,
    next: { trangThai: boolean; role: UserWithRole['role'] },
  ): Promise<void> {
    const isActiveAdmin = (state: {
      trangThai: boolean;
      role: UserWithRole['role'];
    }) =>
      state.trangThai &&
      state.role?.maRole === ROLE.ADMIN &&
      state.role.trangThai;

    if (!isActiveAdmin(current) || isActiveAdmin(next)) {
      return;
    }
    const others = await tx.user.count({
      where: {
        id: { not: current.id },
        trangThai: true,
        role: { is: { maRole: ROLE.ADMIN, trangThai: true } },
      },
    });
    if (others === 0) {
      throw new AppException('USER_LAST_ADMIN');
    }
  }
}
