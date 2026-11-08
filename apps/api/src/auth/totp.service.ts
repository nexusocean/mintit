import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Like, Repository } from 'typeorm';
import { TOTP } from '@otplib/totp';
import { NodeCryptoPlugin } from '@otplib/plugin-crypto-node';
import { ScureBase32Plugin } from '@otplib/plugin-base32-scure';
import * as qrcode from 'qrcode';
import * as argon2 from 'argon2';
import { User } from './schemas/user.entity';
import { BackupCode } from './schemas/backup-code.entity';
import type { EnvironmentVariables } from '../config/env.validation';
import { getOrCreateTotpKey } from '../config/totp-key';
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  hashBackupCode,
  isEncryptedSecret,
  BACKUP_CODE_PREFIX,
} from './totp-crypto';

const TOTP_TOKEN = /^\d{6}$/;

@Injectable()
export class TotpService implements OnModuleInit {
  private readonly logger = new Logger(TotpService.name);
  private readonly key = getOrCreateTotpKey();
  private readonly totp = new TOTP({
    crypto: new NodeCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });

  private readonly demoAdminTotp?: string;
  private readonly totpDisabled: boolean;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BackupCode)
    private readonly backupCodeRepo: Repository<BackupCode>,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.demoAdminTotp = configService.get('DEMO_ADMIN_TOTP');
    this.totpDisabled = Boolean(
      configService.get('AUTH_DISABLE_TOTP', { infer: true }),
    );
  }

  // One-time upgrade of rows written before secrets were encrypted and backup
  // codes hashed. Idempotent: already-protected values are left as they are.
  async onModuleInit(): Promise<void> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.totpSecret')
      .getMany();

    for (const user of users) {
      if (user.totpSecret && !isEncryptedSecret(user.totpSecret)) {
        await this.userRepo.update(
          { id: user.id },
          { totpSecret: encryptSecret(this.key, user.totpSecret) },
        );
        this.logger.log(`Encrypted stored 2FA secret for user ${user.id}`);
      }
    }

    const plainCodes = await this.backupCodeRepo.find({
      where: { codeHash: Not(Like(`${BACKUP_CODE_PREFIX}%`)) },
    });
    for (const code of plainCodes) {
      await this.backupCodeRepo.update(
        { id: code.id },
        { codeHash: hashBackupCode(this.key, code.codeHash) },
      );
    }
    if (plainCodes.length > 0) {
      this.logger.log(`Hashed ${plainCodes.length} stored backup code(s)`);
    }
  }

  // Replaces the user's codes of one kind (active or pending) with new ones.
  private async replaceBackupCodes(
    manager: EntityManager,
    userId: string,
    hashes: string[],
    pending: boolean,
  ): Promise<void> {
    await manager.delete(BackupCode, { userId, pending });
    await manager.insert(
      BackupCode,
      hashes.map((codeHash) => ({ userId, codeHash, pending })),
    );
  }

  private isDemoTotp(token: string): boolean {
    return Boolean(this.demoAdminTotp) && token === this.demoAdminTotp;
  }

  async setup(
    email: string,
    password: string,
  ): Promise<{ qrCode: string; secret: string; backupCodes: string[] }> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // First-time setup only. Once the account is active, replacing the secret
    // here would let anyone with the password bypass (and hijack) 2FA.
    if (user.isValid) {
      throw new ForbiddenException('2FA already set up');
    }

    const generated = await this.generate(user.email);

    // Shown to the user once; only the encrypted secret and keyed hashes are kept.
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(
        User,
        { id: user.id },
        { totpSecret: generated.encryptedSecret },
      );
      await this.replaceBackupCodes(
        manager,
        user.id,
        generated.hashedBackupCodes,
        false,
      );
    });

    return {
      qrCode: generated.qrCode,
      secret: generated.secret,
      backupCodes: generated.backupCodes,
    };
  }

  private async generate(label: string) {
    const secret = this.totp.generateSecret();
    const otpAuthUrl = this.totp.toURI({ label, issuer: 'mintit', secret });
    const qrCode = await qrcode.toDataURL(otpAuthUrl);
    const backupCodes = generateBackupCodes();
    return {
      secret,
      qrCode,
      backupCodes,
      encryptedSecret: encryptSecret(this.key, secret),
      hashedBackupCodes: backupCodes.map((c) => hashBackupCode(this.key, c)),
    };
  }

  private assertResettable(): void {
    if (this.totpDisabled) {
      throw new BadRequestException('2FA is disabled');
    }
    // A fixed demo code means a shared demo account; keep its 2FA as is.
    if (this.demoAdminTotp) {
      throw new ForbiddenException('2FA reset is disabled in demo mode');
    }
  }

  // Step one of replacing an active account's secret. The new secret is held
  // as pending; the current one keeps working until confirmReset succeeds.
  async startReset(
    userId: string,
    password: string,
  ): Promise<{ qrCode: string; secret: string; backupCodes: string[] }> {
    this.assertResettable();

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .andWhere('user.isValid = true')
      .getOne();

    if (!user) throw new UnauthorizedException('User not registered');

    // 403 rather than 401: the web client treats a 401 as an expired session
    // and redirects to the login page.
    if (!(await argon2.verify(user.password, password))) {
      throw new ForbiddenException('Invalid password');
    }

    const generated = await this.generate(user.email);
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(
        User,
        { id: user.id },
        { pendingTotpSecret: generated.encryptedSecret },
      );
      await this.replaceBackupCodes(
        manager,
        user.id,
        generated.hashedBackupCodes,
        true,
      );
    });

    return {
      qrCode: generated.qrCode,
      secret: generated.secret,
      backupCodes: generated.backupCodes,
    };
  }

  async confirmReset(userId: string, token: string): Promise<void> {
    this.assertResettable();

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.pendingTotpSecret')
      .where('user.id = :id', { id: userId })
      .andWhere('user.isValid = true')
      .getOne();

    if (!user) throw new UnauthorizedException('User not registered');
    if (!user.pendingTotpSecret) {
      throw new BadRequestException('No 2FA reset in progress');
    }
    if (!TOTP_TOKEN.test(token)) {
      throw new ForbiddenException('Invalid code. Please try again.');
    }

    const result = await this.totp.verify(token, {
      secret: decryptSecret(this.key, user.pendingTotpSecret),
    });
    if (!result.valid)
      throw new ForbiddenException('Invalid code. Please try again.');

    const pendingSecret = user.pendingTotpSecret;
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(
        User,
        { id: user.id },
        {
          totpSecret: pendingSecret,
          // The confirming code can't then be replayed at login.
          lastUsedTotp: token,
          pendingTotpSecret: null,
        },
      );
      await manager.delete(BackupCode, { userId: user.id, pending: false });
      await manager.update(
        BackupCode,
        { userId: user.id, pending: true },
        { pending: false },
      );
    });
  }

  async verify(
    email: string,
    password: string,
    token: string,
  ): Promise<User | null> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.password', 'user.totpSecret'])
      .where('user.email = :email', { email })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await argon2.verify(user.password, password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    // Completes first-time setup only; active accounts sign in via /auth/login.
    if (user.isValid) throw new ForbiddenException('2FA already set up');

    if (this.isDemoTotp(token)) {
      await this.userRepo.update({ id: user.id }, { isValid: true });
      return this.userRepo.findOne({ where: { id: user.id } });
    }

    if (!user.totpSecret) throw new UnauthorizedException('2FA not set up');
    if (!TOTP_TOKEN.test(token)) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const result = await this.totp.verify(token, {
      secret: decryptSecret(this.key, user.totpSecret),
    });
    if (!result.valid) throw new UnauthorizedException('Invalid 2FA code');

    await this.userRepo.update({ id: user.id }, { isValid: true });
    return this.userRepo.findOne({ where: { id: user.id } });
  }

  async backupCodesRemaining(userId: string): Promise<number> {
    return this.backupCodeRepo.count({
      where: { userId, pending: false, usedAt: IsNull() },
    });
  }

  async validateTotp(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.totpSecret', 'user.lastUsedTotp'])
      .where('user.id = :id', { id: userId })
      .getOne();

    if (this.isDemoTotp(token)) {
      return true;
    }

    if (!user?.totpSecret) return false;

    if (user.lastUsedTotp === token) {
      return false;
    }

    // otplib throws (rather than returning invalid) on anything that isn't a
    // 6-digit token, so only authenticator-shaped input goes to it; everything
    // else is checked as a backup code.
    if (TOTP_TOKEN.test(token)) {
      const result = await this.totp.verify(token, {
        secret: decryptSecret(this.key, user.totpSecret),
      });
      if (result.valid) {
        await this.userRepo.update({ id: userId }, { lastUsedTotp: token });
        return true;
      }
      return false;
    }

    // A single conditional UPDATE, so two concurrent logins can't both spend
    // the same code.
    const { affected } = await this.backupCodeRepo.update(
      {
        userId,
        codeHash: hashBackupCode(this.key, token),
        pending: false,
        usedAt: IsNull(),
      },
      { usedAt: new Date() },
    );
    return affected === 1;
  }
}
