import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { PayloadDto } from './dto/payload.dto';
import { getOrCreateJwtSecret } from '../config/jwt-secret';
import { readSessionCookie } from './session-cookie';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: readSessionCookie,
      ignoreExpiration: false,
      secretOrKey: getOrCreateJwtSecret(),
    });
  }

  async validate(payload: PayloadDto): Promise<PayloadDto> {
    const user = await this.authService.me(payload.sub);
    if (!user) throw new UnauthorizedException();
    return payload;
  }
}
