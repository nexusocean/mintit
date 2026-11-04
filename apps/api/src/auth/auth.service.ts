import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  RegisterDto,
  LoginDto,
  UpdateDto,
  TotpVerifyDto,
} from './dto/user.dto';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { User } from './schemas/user.entity';
import { StatusResponseDto } from './dto/auth-response.dto';
import { TotpService } from './totp.service';
import type { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class AuthService {
  private readonly totpRequired: boolean;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly totpService: TotpService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.totpRequired = !config.get('AUTH_DISABLE_TOTP', { infer: true });
  }

  async status(): Promise<StatusResponseDto> {
    const registered = await this.userRepo.findOne({
      where: { isValid: true },
    });

    return {
      registered: Boolean(registered),
      totpRequired: this.totpRequired,
    };
  }

  async me(sub: string) {
    const user = await this.userRepo.findOne({
      where: { id: sub, isValid: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not registered');
    }

    return user;
  }

  async register(registerDto: RegisterDto): Promise<void> {
    await this.userRepo.delete({ isValid: false });

    const adminExists = await this.userRepo.count({
      where: { isValid: true },
    });
    if (adminExists > 0) {
      throw new ForbiddenException('Admin user already registered');
    }

    const hashedPassword = await argon2.hash(registerDto.password);
    await this.userRepo.save(
      this.userRepo.create({
        email: registerDto.email.toLowerCase(),
        password: hashedPassword,
        // Without TOTP there's no setup/verify step to activate the account.
        isValid: !this.totpRequired,
      }),
    );
  }

  async verifyTotp(dto: TotpVerifyDto): Promise<string> {
    const user = await this.totpService.verify(
      dto.email,
      dto.password,
      dto.token,
    );

    if (!user) {
      throw new ForbiddenException('Unable to verify user');
    }

    return this.generateToken(user);
  }

  async login(loginDto: LoginDto): Promise<string> {
    const user = await this.validateUser(loginDto);

    if (!this.totpRequired) return this.generateToken(user);

    const { token } = loginDto;
    const totpValid =
      !!token && (await this.totpService.validateTotp(user.id, token));

    if (!totpValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    return this.generateToken(user);
  }

  async update(sub: string, updateDto: UpdateDto) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: sub })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not registered');
    }

    const isPasswordValid = await argon2.verify(
      user.password,
      updateDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const updates: Partial<{ email: string; password: string }> = {};

    if (updateDto.email !== user.email) {
      updates.email = updateDto.email.toLowerCase();
    }

    if (updateDto.newPassword) {
      updates.password = await argon2.hash(updateDto.newPassword);
    }

    await this.userRepo.update({ id: sub }, updates);

    return { email: updates.email ?? user.email };
  }

  async validateUser(loginDto: LoginDto): Promise<User> {
    const user = await this.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(
      user.password,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isValid) {
      throw new UnauthorizedException('Account setup incomplete');
    }

    return user;
  }

  generateToken(user: User): string {
    return this.jwtService.sign({ sub: user.id });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .andWhere('user.isValid = true')
      .getOne();
  }
}
