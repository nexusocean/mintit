import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserScope } from '@mintit/types';
import { ROLES_KEY } from './roles.decorator';
import { PayloadDto } from './dto/payload.dto';

/**
 * Runs after JwtAuthGuard, which puts the user's scope (loaded from the
 * database, not the token) on the request. Routes without @Roles are open to
 * any signed-in user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserScope[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;

    const user = ctx.switchToHttp().getRequest<{ user?: PayloadDto }>().user;
    if (user?.scope?.some((s) => required.includes(s))) return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
