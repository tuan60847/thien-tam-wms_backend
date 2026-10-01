import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
