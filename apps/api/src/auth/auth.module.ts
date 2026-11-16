import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { User } from './schemas/user.entity';
import { BackupCode } from './schemas/backup-code.entity';
import { TotpService } from './totp.service';
import { getOrCreateJwtSecret } from '../config/jwt-secret';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User, BackupCode]),
    JwtModule.register({
      secret: getOrCreateJwtSecret(),
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TotpService, RolesGuard],
  exports: [AuthService, TotpService, RolesGuard],
})
export class AuthModule {}
