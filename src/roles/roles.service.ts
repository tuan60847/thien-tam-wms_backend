import { Injectable } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { ROLE } from '../auth/roles.constants.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { QueryRoleDto } from './dto/query-role.dto.js';
import type { RoleResponseDto } from './dto/role-response.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';
import { toRoleResponse } from './roles.mapper.js';

const SORT_WHITELIST = ['maRole', 'tenRole', 'createdAt'] as const;

// Only users who are active count towards a role's headcount.
const withActiveUserCount = {
  _count: { select: { users: { where: { trangThai: true } } } },
} satisfies Prisma.RoleInclude;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(query: QueryRoleDto): Promise<PagedResponse<RoleResponseDto>> {
    const where: Prisma.RoleWhereInput = {
      trangThai: query.trangThai,
      OR: query.q
        ? [
            { maRole: { contains: query.q } },
            { tenRole: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'maRole', direction: 'asc' },
      ]),
    ) as Prisma.RoleOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.role.findMany({
          where,
          orderBy,
          skip,
          take,
          include: withActiveUserCount,
        }),
      count: () => this.prisma.role.count({ where }),
      map: toRoleResponse,
    });
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: withActiveUserCount,
    });
    if (!role) {
      throw new AppException('ROLE_NOT_FOUND');
    }
    return toRoleResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    if (
      dto.tenRole === undefined &&
      dto.moTa === undefined &&
      dto.trangThai === undefined
    ) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          { field: 'body', messages: ['Cần ít nhất một trường để cập nhật'] },
        ],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id } });
      if (!role) {
        throw new AppException('ROLE_NOT_FOUND');
      }

      if (dto.trangThai === false && role.trangThai) {
        if (role.maRole === ROLE.ADMIN) {
          throw new AppException('ROLE_SYSTEM_PROTECTED');
        }
        const active = await tx.user.count({
          where: { roleId: id, trangThai: true },
        });
        if (active > 0) {
          throw new AppException('ROLE_HAS_ACTIVE_USERS', {
            details: { soNguoiDung: active },
          });
        }
      }

      const data: Prisma.RoleUpdateInput = {
        tenRole: dto.tenRole,
        moTa: dto.moTa,
        trangThai: dto.trangThai,
      };
      const updated = await tx.role.update({ where: { id }, data });
      await this.audit.record(
        {
          hanhDong: 'role.update',
          doiTuong: 'role',
          doiTuongId: id,
          truoc: pick(role),
          sau: pick(updated),
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  // Role exists and is active, otherwise the user cannot be given this role.
  async assertAssignable(
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Role> {
    const client = tx ?? this.prisma;
    const role = await client.role.findUnique({ where: { id: roleId } });
    if (!role?.trangThai) {
      throw new AppException('USER_ROLE_INVALID');
    }
    return role;
  }
}

function pick(role: Role) {
  return { tenRole: role.tenRole, moTa: role.moTa, trangThai: role.trangThai };
}
