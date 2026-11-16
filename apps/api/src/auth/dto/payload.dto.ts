import { UserScope } from '@mintit/types';

/** The signed session token's claims. */
export class JwtClaimsDto {
  sub: string;
}

/**
 * The signed-in user as JwtStrategy puts it on the request. The scope is read
 * from the database on every request, so role changes apply immediately.
 */
export class PayloadDto {
  sub: string;
  scope: UserScope[];
}
