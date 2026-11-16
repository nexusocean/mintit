import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/schemas/user.entity';
import { getOrCreateJwtSecret } from '../config/jwt-secret';
import { UsersController } from './users.controller';
import { InviteController } from './invite.controller';
import { INVITE_JWT, UsersService } from './users.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [UsersController, InviteController],
  providers: [
    {
      // Invites get their own key derived from the session secret, so an
      // invite token can never pass as a session cookie, or vice versa.
      provide: INVITE_JWT,
      useFactory: () =>
        new JwtService({
          secret: createHmac('sha256', getOrCreateJwtSecret())
            .update('mintit:invite')
            .digest('hex'),
        }),
    },
    UsersService,
  ],
})
export class UsersModule {}
