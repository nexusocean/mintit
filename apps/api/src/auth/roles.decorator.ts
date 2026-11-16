import { SetMetadata } from '@nestjs/common';
import { UserScope } from '@mintit/types';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users holding one of the given scopes. A method-level
 * @Roles replaces the controller-level one, so a controller can default to
 * admin-only and open individual routes to managers.
 */
export const Roles = (...roles: UserScope[]) => SetMetadata(ROLES_KEY, roles);

/** The single role a user acts as; admin wins if both scopes are held. */
export const roleOf = (scope: UserScope[] | undefined): UserScope =>
  scope?.includes(UserScope.ADMIN) ? UserScope.ADMIN : UserScope.MANAGER;
