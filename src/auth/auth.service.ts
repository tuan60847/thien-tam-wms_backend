import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { authConfig } from '../config/auth.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService, type UserWithRole } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { AuthenticatedUser } from './types/authenticated-user.type.js';
import type {
  JwtPayload,
  RefreshTokenPayload,
} from './types/jwt-payload.type.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends IssuedTokens {
  user: AuthenticatedUser;
}

export const BCRYPT_COST = 10;

const MSG_BAD_CREDENTIALS = 'Sai tài khoản hoặc mật khẩu';
const MSG_INVALID_SESSION = 'Phiên đăng nhập không hợp lệ';
const MSG_LOCKED = 'Tài khoản đã bị khóa';

// Dummy hash so response time for an unknown username stays close to a wrong password.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), BCRYPT_COST);

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByUsername(dto.username);
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.password ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException(MSG_BAD_CREDENTIALS);
    }
    if (!user.trangThai) {
      throw new UnauthorizedException(MSG_LOCKED);
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toAuthenticatedUser(user) };
  }

  async refresh(dto: RefreshTokenDto): Promise<IssuedTokens> {
    try {
      await this.jwt.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.config.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(MSG_INVALID_SESSION);
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(dto.refreshToken) },
    });
    if (!stored) {
      throw new UnauthorizedException(MSG_INVALID_SESSION);
    }
    if (stored.revokedAt) {
      // A rotated token is being reused: treat it as leaked and revoke every session.
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(MSG_INVALID_SESSION);
    }
    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(MSG_INVALID_SESSION);
    }

    const user = await this.users.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException(MSG_INVALID_SESSION);
    }
    if (!user.trangThai) {
      throw new UnauthorizedException(MSG_LOCKED);
    }

    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.signTokens(user);

    await this.prisma.$transaction(async (tx) => {
      // The revokedAt: null condition stops two concurrent refreshes from both succeeding.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count !== 1) {
        throw new UnauthorizedException(MSG_INVALID_SESSION);
      }
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshExpiresAt,
        },
      });
    });

    return { accessToken, refreshToken };
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(dto.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validateUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException(MSG_INVALID_SESSION);
    }
    if (!user.trangThai) {
      throw new UnauthorizedException(MSG_LOCKED);
    }
    return this.toAuthenticatedUser(user);
  }

  private async issueTokens(user: UserWithRole): Promise<IssuedTokens> {
    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.signTokens(user);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });
    return { accessToken, refreshToken };
  }

  private async signTokens(user: UserWithRole) {
    const role = this.effectiveRole(user);
    const accessPayload: JwtPayload = {
      sub: user.id,
      maNV: user.maNV,
      roleMa: role?.maRole ?? null,
      roleTen: role?.tenRole ?? null,
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: randomUUID(),
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.accessSecret,
      expiresIn: this.config.accessTtl as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.refreshSecret,
      expiresIn: this.config.refreshTtl as JwtSignOptions['expiresIn'],
    });
    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: new Date(exp * 1000),
    };
  }

  // A deactivated role is treated as no role.
  private effectiveRole(user: UserWithRole) {
    return user.role?.trangThai ? user.role : null;
  }

  private toAuthenticatedUser(user: UserWithRole): AuthenticatedUser {
    const role = this.effectiveRole(user);
    return {
      id: user.id,
      maNV: user.maNV,
      username: user.username,
      hoTen: user.hoTen,
      email: user.email,
      role: role ? { maRole: role.maRole, tenRole: role.tenRole } : null,
    };
  }
}
