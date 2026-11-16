import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserScope } from '@mintit/types';
import { UsersService } from '../../src/users/users.service';
import { UserStatus } from '../../src/users/dto/users.dto';
import { RolesGuard } from '../../src/auth/roles.guard';
import { ROLES_KEY } from '../../src/auth/roles.decorator';
import { AuthService } from '../../src/auth/auth.service';

type Row = {
  id: string;
  email: string;
  password: string;
  scope: UserScope[];
  isValid: boolean;
  createdAt: Date;
};

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
let nextId = 2;

/** Just enough of Repository<User> and EntityManager for UsersService. */
function makeRepo(rows: Row[]) {
  const where = (w: Partial<Row>) => (r: Row) =>
    Object.entries(w).every(([k, v]) => r[k as keyof Row] === v);
  const pick = (r: Row) => ({ ...r });

  const update = jest.fn(async (w: Partial<Row>, set: Partial<Row>) => {
    const hit = rows.filter(where(w));
    hit.forEach((r) => Object.assign(r, set));
    return { affected: hit.length };
  });
  const findOne = async (opts: { where: Partial<Row> }) => {
    const r = rows.find(where(opts.where));
    return r ? pick(r) : null;
  };
  const manager = {
    findOne: (_e: unknown, opts: { where: Partial<Row> }) => findOne(opts),
    update: (_e: unknown, w: Partial<Row>, set: Partial<Row>) => update(w, set),
    delete: jest.fn(async (_e: unknown, w: Partial<Row>) => {
      const i = rows.findIndex(where(w));
      if (i >= 0) rows.splice(i, 1);
    }),
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: async () =>
        rows
          .filter((r) => r.isValid && r.scope.includes(UserScope.ADMIN))
          .map(pick),
    }),
  };
  const repo = {
    rows,
    update,
    manager: {
      transaction: (cb: (m: typeof manager) => unknown) => cb(manager),
    },
    find: async () => rows.map(pick),
    findOne,
    exists: async (opts: { where: Partial<Row> }) =>
      rows.some(where(opts.where)),
    create: (r: Partial<Row>) => r,
    save: async (r: Partial<Row>) => {
      const row = {
        id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
        createdAt: new Date(),
        ...r,
      } as Row;
      rows.push(row);
      return pick(row);
    },
    count: async (opts: { where: Partial<Row> }) =>
      rows.filter(where(opts.where)).length,
    delete: jest.fn(async (w: Partial<Row>) => {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (where(w)(rows[i])) rows.splice(i, 1);
      }
    }),
    createQueryBuilder: () => {
      let id: string;
      const qb = {
        addSelect: () => qb,
        where: (_s: string, p: { id: string }) => {
          id = p.id;
          return qb;
        },
        getOne: async () => {
          const r = rows.find((x) => x.id === id);
          return r ? pick(r) : null;
        },
      };
      return qb;
    },
  };
  return repo;
}

const admin = (id = ADMIN_ID, email = 'admin@example.com'): Row => ({
  id,
  email,
  password: 'hash',
  scope: [UserScope.ADMIN],
  isValid: true,
  createdAt: new Date(0),
});

function setup(
  opts: { rows?: Row[]; demo?: boolean; totpDisabled?: boolean } = {},
) {
  const repo = makeRepo(opts.rows ?? [admin()]);
  const jwt = new JwtService({ secret: 'test-invite-secret' });
  const config = {
    get: (k: string) =>
      k === 'DEMO_ADMIN_TOTP'
        ? opts.demo
          ? '000000'
          : undefined
        : k === 'AUTH_DISABLE_TOTP'
          ? Boolean(opts.totpDisabled)
          : undefined,
  };
  const service = new UsersService(repo as never, jwt, config as never);
  return { service, repo, jwt };
}

describe('UsersService invites', () => {
  it('creates a pending user with the requested role', async () => {
    const { service, repo } = setup();
    const { user, token } = await service.invite(
      'Staff@Example.com',
      UserScope.MANAGER,
    );

    expect(user).toMatchObject({
      email: 'staff@example.com',
      role: UserScope.MANAGER,
      status: UserStatus.Pending,
    });
    expect(token).toEqual(expect.any(String));
    expect(repo.rows.find((r) => r.id === user.id)?.isValid).toBe(false);
  });

  it('refuses an email that is already in use', async () => {
    const { service } = setup();
    await expect(
      service.invite('admin@example.com', UserScope.MANAGER),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts an invite once and sets the password', async () => {
    const { service, repo } = setup();
    const { user, token } = await service.invite(
      'staff@example.com',
      UserScope.MANAGER,
    );

    await expect(service.acceptInvite(token, 'new-password')).resolves.toEqual({
      email: 'staff@example.com',
      totpRequired: true,
    });
    const row = repo.rows.find((r) => r.id === user.id)!;
    expect(await argon2.verify(row.password, 'new-password')).toBe(true);
    // Still pending until 2FA setup completes.
    expect(row.isValid).toBe(false);

    await expect(
      service.acceptInvite(token, 'another-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates right away when TOTP is disabled', async () => {
    const { service, repo } = setup({ totpDisabled: true });
    const { user, token } = await service.invite(
      'staff@example.com',
      UserScope.MANAGER,
    );
    await service.acceptInvite(token, 'new-password');
    expect(repo.rows.find((r) => r.id === user.id)?.isValid).toBe(true);
  });

  it('invalidates the old link when reissued', async () => {
    const { service } = setup();
    const first = await service.invite('staff@example.com', UserScope.MANAGER);
    const second = await service.reissueInvite(first.user.id);

    await expect(
      service.acceptInvite(first.token, 'new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.acceptInvite(second.token, 'new-password'),
    ).resolves.toBeDefined();
  });

  it('rejects expired, forged and malformed tokens', async () => {
    const { service, jwt } = setup();
    const { user } = await service.invite(
      'staff@example.com',
      UserScope.MANAGER,
    );

    const expired = jwt.sign({ sub: user.id, fp: 'x' }, { expiresIn: -1 });
    const forged = new JwtService({ secret: 'other' }).sign({
      sub: user.id,
      fp: 'x',
    });
    const noFingerprint = jwt.sign({ sub: user.id });

    for (const token of [expired, forged, noFingerprint, 'garbage']) {
      await expect(
        service.acceptInvite(token, 'new-password'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("won't reissue for a user who has joined", async () => {
    const { service } = setup();
    await expect(service.reissueInvite(ADMIN_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('is disabled in demo mode', async () => {
    const { service } = setup({ demo: true });
    await expect(
      service.invite('staff@example.com', UserScope.MANAGER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UsersService roles and removal', () => {
  const OTHER_ID = '00000000-0000-4000-8000-0000000000aa';

  it('promotes and demotes another user', async () => {
    const other = { ...admin(OTHER_ID, 'b@example.com') };
    other.scope = [UserScope.MANAGER];
    const { service, repo } = setup({ rows: [admin(), other] });

    await expect(
      service.updateRole(ADMIN_ID, OTHER_ID, UserScope.ADMIN),
    ).resolves.toMatchObject({ role: UserScope.ADMIN });
    await expect(
      service.updateRole(ADMIN_ID, OTHER_ID, UserScope.MANAGER),
    ).resolves.toMatchObject({ role: UserScope.MANAGER });
    expect(repo.rows[1].scope).toEqual([UserScope.MANAGER]);
  });

  it("won't let an admin change their own role or remove themselves", async () => {
    const { service } = setup();
    await expect(
      service.updateRole(ADMIN_ID, ADMIN_ID, UserScope.MANAGER),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove(ADMIN_ID, ADMIN_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses an actor who lost admin mid-race', async () => {
    // B was demoted by A a moment ago; B's request to demote A must fail,
    // or there would be no admins left.
    const b = { ...admin(OTHER_ID, 'b@example.com') };
    b.scope = [UserScope.MANAGER];
    const { service, repo } = setup({ rows: [admin(), b] });

    await expect(
      service.updateRole(OTHER_ID, ADMIN_ID, UserScope.MANAGER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(OTHER_ID, ADMIN_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.rows[0].scope).toEqual([UserScope.ADMIN]);
  });

  it('removes a pending admin invite', async () => {
    const pendingAdmin = { ...admin(OTHER_ID, 'b@example.com') };
    pendingAdmin.isValid = false;
    const { service } = setup({ rows: [admin(), pendingAdmin] });
    // Removing a pending admin is fine: they don't count toward the minimum.
    await expect(service.remove(ADMIN_ID, OTHER_ID)).resolves.toBeUndefined();
  });

  it('removes another admin when one remains', async () => {
    const { service, repo } = setup({
      rows: [admin(), admin(OTHER_ID, 'b@example.com')],
    });
    await service.remove(ADMIN_ID, OTHER_ID);
    expect(repo.rows.map((r) => r.id)).toEqual([ADMIN_ID]);
  });

  it('404s an unknown user', async () => {
    const { service } = setup();
    await expect(service.remove(ADMIN_ID, OTHER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('RolesGuard', () => {
  const ctx = (scope: UserScope[] | undefined, handlerRoles?: UserScope[]) => {
    const handler = () => undefined;
    class Ctrl {}
    Reflect.defineMetadata(ROLES_KEY, [UserScope.ADMIN], Ctrl);
    if (handlerRoles) Reflect.defineMetadata(ROLES_KEY, handlerRoles, handler);
    return {
      getHandler: () => handler,
      getClass: () => Ctrl,
      switchToHttp: () => ({
        getRequest: () => ({ user: scope && { sub: 'u', scope } }),
      }),
    } as unknown as ExecutionContext;
  };
  const guard = new RolesGuard(new Reflector());

  it('lets an admin through an admin-only route', () => {
    expect(guard.canActivate(ctx([UserScope.ADMIN]))).toBe(true);
  });

  it('blocks a manager from an admin-only route', () => {
    expect(() => guard.canActivate(ctx([UserScope.MANAGER]))).toThrow(
      ForbiddenException,
    );
  });

  it('lets a route open itself to managers', () => {
    expect(
      guard.canActivate(
        ctx([UserScope.MANAGER], [UserScope.ADMIN, UserScope.MANAGER]),
      ),
    ).toBe(true);
  });

  it('blocks a request with no user', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});

describe('AuthService.register', () => {
  it('leaves pending invites alone once an account is active', async () => {
    const pending = { ...admin(ADMIN_ID.replace('1', '2'), 'p@example.com') };
    pending.isValid = false;
    const repo = makeRepo([admin(), pending]);
    const service = new AuthService(
      repo as never,
      {} as never,
      {} as never,
      { get: () => undefined } as never,
    );

    await expect(
      service.register({ email: 'x@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(repo.rows).toHaveLength(2);
  });
});
