import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  UpdateDto,
  TotpVerifyDto,
  TotpSetupDto,
} from './dto/user.dto';
import {
  MeResponseDto,
  UpdateResponseDto,
  StatusResponseDto,
  TotpSetupResponseDto,
} from './dto/auth-response.dto';
import { GetUser } from '../decorators/get-user';
import { PayloadDto } from './dto/payload.dto';
import { TotpService } from './totp.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

// the global default to slow down credential guessing.
const CREDENTIAL_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
  ) {}

  @ApiOperation({ summary: 'Check whether an admin user has been registered' })
  @ApiResponse({ status: 200, type: StatusResponseDto })
  @Get('status')
  async status(): Promise<StatusResponseDto> {
    return await this.authService.status();
  }

  @ApiOperation({ summary: 'Get current admin user' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@GetUser() user: PayloadDto): Promise<MeResponseDto> {
    return await this.authService.me(user.sub);
  }

  @ApiOperation({
    summary: 'Register admin user',
    description: 'Only succeeds once. Returns 403 if an admin already exists.',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Admin user already registered' })
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<void> {
    await this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Setup TOTP' })
  @ApiResponse({ status: 201, type: TotpSetupResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('setup')
  async totpSetup(@Body() dto: TotpSetupDto): Promise<TotpSetupResponseDto> {
    return await this.totpService.setup(dto.email, dto.password);
  }

  @ApiOperation({
    summary: 'Verify TOTP and complete setup',
    description: 'Sets the httpOnly session cookie on success.',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 401, description: 'Invalid credentials or TOTP code' })
  @HttpCode(204)
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('verify')
  async totpVerify(
    @Body() dto: TotpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.authService.verifyTotp(dto);
    setSessionCookie(req, res, token);
  }

  @ApiOperation({
    summary: 'Login as admin',
    description: 'Sets the httpOnly session cookie on success.',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @HttpCode(204)
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.authService.login(loginDto);
    setSessionCookie(req, res, token);
  }

  @ApiOperation({ summary: 'Logout (clears the session cookie)' })
  @ApiResponse({ status: 204 })
  @HttpCode(204)
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(req, res);
  }

  @ApiOperation({ summary: 'Update admin email or password' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: UpdateResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or missing token',
  })
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  async update(
    @GetUser() user: PayloadDto,
    @Body() updateDto: UpdateDto,
  ): Promise<UpdateResponseDto> {
    return await this.authService.update(user.sub, updateDto);
  }
}
