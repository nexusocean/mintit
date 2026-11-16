import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { UserScope } from '@mintit/types';
import { User } from '../auth/schemas/user.entity';
import { roleOf } from '../auth/roles.decorator';
import { safeEqual } from '../auth/safe-equal';
import type { EnvironmentVariables } from '../config/env.validation';
import {
  AcceptInviteResponseDto,
  InviteResponseDto,
  UserResponseDto,
  UserStatus,
} from './dto/users.dto';

export const INVITE_TTL_SECONDS = 72 * 60 * 60;
// Injection token for the JwtService that signs invites with their own key.
export const INVITE_JWT = Symbol('INVITE_JWT');

interface InviteClaims {
  sub: string;
  // Fingerprint of the password hash at issue time. Accepting the invite (or
  // reissuing it) replaces the hash, which is what makes the token single-use
  // without storing it.
  fp: string;
}

const INVALID_INVITE = 'This invite link is invalid or has expired';

const fingerprint = (passwordHash: string): string =>
  createHash('sha256').update(passwordHash).digest('base64url');

// A password nobody knows, so a pending account can't be set up or signed in
// to until the invite is accepted.
const unusablePassword = (): Promise<string> =>
  argon2.hash(randomBytes(32).toString('base64url'));

export const toUserResponse = (user: User): UserResponseDto => ({
  id: user.id,
  email: user.email,
  role: roleOf(user.scope),
  status: user.isValid ? UserStatus.Active : UserStatus.Pending,
  createdAt: user.createdAt,
});

@Injectable()
export class UsersService {
  private readonly totpRequired: boolean;
  // Demo instances share one account; don't let visitors add or remove users.
  private readonly locked: boolean;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(INVITE_JWT) private readonly inviteJwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.totpRequired = !config.get('AUTH_DISABLE_TOTP', { infer: true });
    this.locked = Boolean(config.get('DEMO_ADMIN_TOTP', { infer: true }));
  }

  private assertUnlocked(): void {
    if (this.locked) {
      throw new ForbiddenException('User management is disabled in demo mode');
    }
  }

  async list(): Promise<UserResponseDto[]> {
    const users = await this.userRepo.find({ order: { createdAt: 'ASC' } });
    return users.map(toUserResponse);
  }

  async invite(email: string, role: UserScope): Promise<InviteResponseDto> {
    this.assertUnlocked();
    const normalized = email.toLowerCase();

    if (await this.userRepo.exists({ where: { email: normalized } })) {
      throw new ConflictException('A user with this email already exists');
    }

    const password = await unusablePassword();
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: normalized,
        password,
        scope: [role],
        isValid: false,
      }),
    );

    return this.issue(user, password);
  }

  /** New link for a pending user; any earlier link stops working. */
  async reissueInvite(id: string): Promise<InviteResponseDto> {
    this.assertUnlocked();

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isValid) {
      throw new BadRequestException('User has already joined');
    }

    const password = await unusablePassword();
    await this.userRepo.update({ id }, { password });
    return this.issue(user, password);
  }

  private issue(user: User, passwordHash: string): InviteResponseDto {
    const claims: InviteClaims = {
      sub: user.id,
      fp: fingerprint(passwordHash),
    };
    return {
      user: toUserResponse(user),
      token: this.inviteJwt.sign(claims, { expiresIn: INVITE_TTL_SECONDS }),
      expiresAt: new Date(Date.now() + INVITE_TTL_SECONDS * 1000),
    };
  }

  async acceptInvite(
    token: string,
    password: string,
  ): Promise<AcceptInviteResponseDto> {
    let claims: InviteClaims;
    try {
      claims = this.inviteJwt.verify<InviteClaims>(token);
    } catch {
      throw new BadRequestException(INVALID_INVITE);
    }

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: claims.sub })
      .getOne();

    if (
      !user ||
      user.isValid ||
      typeof claims.fp !== 'string' ||
      !safeEqual(fingerprint(user.password), claims.fp)
    ) {
      throw new BadRequestException(INVALID_INVITE);
    }

    // Conditional on the old hash, so two concurrent accepts can't both win.
    const { affected } = await this.userRepo.update(
      { id: user.id, password: user.password, isValid: false },
      {
        password: await argon2.hash(password),
        // Without TOTP there's no setup/verify step to activate the account.
        isValid: !this.totpRequired,
      },
    );
    if (affected !== 1) throw new BadRequestException(INVALID_INVITE);

    return { email: user.email, totpRequired: this.totpRequired };
  }

  async updateRole(
    actorId: string,
    id: string,
    role: UserScope,
  ): Promise<UserResponseDto> {
    this.assertUnlocked();
    if (actorId === id) {
      throw new BadRequestException("You can't change your own role");
    }

    return this.userRepo.manager.transaction(async (manager) => {
      const admins = await this.lockAdmins(manager, actorId);
      const target = await manager.findOne(User, { where: { id } });
      if (!target) throw new NotFoundException('User not found');

      if (roleOf(target.scope) !== role) {
        const demotingAdmin = admins.some((a) => a.id === id);
        if (demotingAdmin && admins.length <= 1) {
          throw new ConflictException("Can't demote the last admin");
        }
        await manager.update(User, { id }, { scope: [role] });
        target.scope = [role];
      }

      return toUserResponse(target);
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    this.assertUnlocked();
    if (actorId === id) {
      throw new BadRequestException("You can't remove yourself");
    }

    await this.userRepo.manager.transaction(async (manager) => {
      const admins = await this.lockAdmins(manager, actorId);
      const target = await manager.findOne(User, { where: { id } });
      if (!target) throw new NotFoundException('User not found');

      if (admins.some((a) => a.id === id) && admins.length <= 1) {
        throw new ConflictException("Can't remove the last admin");
      }
      // Backup codes go with it (ON DELETE CASCADE).
      await manager.delete(User, { id });
    });
  }

  /**
   * Locks every active admin row for the rest of the transaction, then checks
   * the actor is still one of them. Two admins demoting or removing each
   * other at once are serialized here, and the second finds it's no longer
   * an admin, so the last admin can't be lost to a race.
   */
  private async lockAdmins(
    manager: EntityManager,
    actorId: string,
  ): Promise<User[]> {
    const admins = await manager
      .createQueryBuilder(User, 'user')
      .setLock('pessimistic_write')
      .where('user.isValid = true')
      .andWhere(':admin = ANY(user.scope)', { admin: UserScope.ADMIN })
      .getMany();

    if (!admins.some((a) => a.id === actorId)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return admins;
  }
}
