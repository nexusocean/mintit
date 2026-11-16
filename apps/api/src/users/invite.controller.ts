import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AcceptInviteDto, AcceptInviteResponseDto } from './dto/users.dto';

@ApiTags('auth')
@Controller('auth/invite')
export class InviteController {
  constructor(private readonly users: UsersService) {}

  @Post('accept')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Accept an invite by choosing a password',
    description:
      'If 2FA is required, continue with /auth/setup and /auth/verify.',
  })
  @ApiCreatedResponse({ type: AcceptInviteResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid, used or expired invite' })
  accept(@Body() dto: AcceptInviteDto): Promise<AcceptInviteResponseDto> {
    return this.users.acceptInvite(dto.token, dto.password);
  }
}
