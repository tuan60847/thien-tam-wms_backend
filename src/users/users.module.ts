import { Module } from '@nestjs/common';
import { RefreshTokenModule } from '../auth/refresh-token/refresh-token.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [RolesModule, RefreshTokenModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
