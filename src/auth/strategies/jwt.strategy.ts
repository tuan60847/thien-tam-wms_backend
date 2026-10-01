import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '../../config/auth.config.js';
import { AuthService } from '../auth.service.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import type { JwtPayload } from '../types/jwt-payload.type.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(authConfig.KEY) config: ConfigType<typeof authConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.accessSecret,
    });
  }

  // Passport only checks signature and expiry; the user lookup lives in AuthService.
  validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return this.authService.validateUser(payload.sub);
  }
}
