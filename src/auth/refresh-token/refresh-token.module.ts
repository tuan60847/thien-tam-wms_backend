import { Module } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service.js';

// Kept separate from AuthModule so UsersModule can revoke tokens without a
// circular dependency (AuthModule imports UsersModule).
@Module({
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class RefreshTokenModule {}
