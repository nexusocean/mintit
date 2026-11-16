import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { JwtClaimsDto, PayloadDto } from './dto/payload.dto';
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

  // Throws for removed or not-yet-active users, so removal takes effect on
  // the next request rather than when the token expires.
  async validate(claims: JwtClaimsDto): Promise<PayloadDto> {
    const user = await this.authService.me(claims.sub);
    if (!user) throw new UnauthorizedException();
    return { sub: user.id, scope: user.scope };
  }
}
