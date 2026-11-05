import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TOTP } from '@otplib/totp';
import { NodeCryptoPlugin } from '@otplib/plugin-crypto-node';
import { ScureBase32Plugin } from '@otplib/plugin-base32-scure';
import * as qrcode from 'qrcode';
import * as argon2 from 'argon2';
import { User } from './schemas/user.entity';
import type { EnvironmentVariables } from '../config/env.validation';
import { getOrCreateTotpKey } from '../config/totp-key';
import { safeEqual } from './safe-equal';
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  hashBackupCode,
  isEncryptedSecret,
  isHashedBackupCode,
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

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.demoAdminTotp = configService.get('DEMO_ADMIN_TOTP');
  }

  // One-time upgrade of rows written before secrets were encrypted and backup
  // codes hashed. Idempotent: already-protected values are left as they are.
  async onModuleInit(): Promise<void> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.totpSecret', 'user.backupCodes'])
      .getMany();

    for (const user of users) {
      const updates: Partial<Pick<User, 'totpSecret' | 'backupCodes'>> = {};
      if (user.totpSecret && !isEncryptedSecret(user.totpSecret)) {
        updates.totpSecret = encryptSecret(this.key, user.totpSecret);
      }
      if (user.backupCodes.some((c) => !isHashedBackupCode(c))) {
        updates.backupCodes = user.backupCodes.map((c) =>
          isHashedBackupCode(c) ? c : hashBackupCode(this.key, c),
        );
      }
      if (Object.keys(updates).length > 0) {
        await this.userRepo.update({ id: user.id }, updates);
        this.logger.log(`Protected stored TOTP data for user ${user.id}`);
      }
    }
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
      throw new ForbiddenException('TOTP already set up');
    }

    const secret = this.totp.generateSecret();
    const otpAuthUrl = this.totp.toURI({
      label: email,
      issuer: 'mintit',
      secret,
    });
    const qrCode = await qrcode.toDataURL(otpAuthUrl);
    const backupCodes = generateBackupCodes();

    // Shown to the user once; only the encrypted secret and keyed hashes are kept.
    await this.userRepo.update(
      { id: user.id },
      {
        totpSecret: encryptSecret(this.key, secret),
        backupCodes: backupCodes.map((c) => hashBackupCode(this.key, c)),
      },
    );

    return { qrCode, secret, backupCodes };
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
    if (user.isValid) throw new ForbiddenException('TOTP already set up');

    if (this.isDemoTotp(token)) {
      await this.userRepo.update({ id: user.id }, { isValid: true });
      return this.userRepo.findOne({ where: { id: user.id } });
    }

    if (!user.totpSecret) throw new UnauthorizedException('TOTP not setup');
    if (!TOTP_TOKEN.test(token)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const result = await this.totp.verify(token, {
      secret: decryptSecret(this.key, user.totpSecret),
    });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP code');

    await this.userRepo.update({ id: user.id }, { isValid: true });
    return this.userRepo.findOne({ where: { id: user.id } });
  }

  async validateTotp(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.totpSecret', 'user.backupCodes', 'user.lastUsedTotp'])
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

    const tokenHash = hashBackupCode(this.key, token);
    const codeIndex = user.backupCodes.findIndex((c) =>
      safeEqual(c, tokenHash),
    );
    if (codeIndex !== -1) {
      user.backupCodes.splice(codeIndex, 1);
      await this.userRepo.update(
        { id: userId },
        { backupCodes: user.backupCodes },
      );
      return true;
    }

    return false;
  }
}
