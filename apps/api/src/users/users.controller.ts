import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserScope } from '@mintit/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetUser } from '../decorators/get-user';
import { PayloadDto } from '../auth/dto/payload.dto';
import { UsersService } from './users.service';
import {
  InviteResponseDto,
  InviteUserDto,
  UpdateUserRoleDto,
  UserResponseDto,
} from './dto/users.dto';

@ApiTags('admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid session cookie' })
@ApiForbiddenResponse({ description: 'Admins only, or demo mode' })
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserScope.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ type: [UserResponseDto] })
  list(): Promise<UserResponseDto[]> {
    return this.users.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Invite a user',
    description:
      'Creates a pending user and returns a single-use invite token valid ' +
      'for 24 hours.',
  })
  @ApiCreatedResponse({ type: InviteResponseDto })
  @ApiConflictResponse({ description: 'Email already in use' })
  invite(@Body() dto: InviteUserDto): Promise<InviteResponseDto> {
    return this.users.invite(dto.email, dto.role);
  }

  @Post(':id/invite')
  @ApiOperation({
    summary: 'Reissue an invite',
    description: 'Earlier invite tokens for this user stop working.',
  })
  @ApiCreatedResponse({ type: InviteResponseDto })
  @ApiBadRequestResponse({ description: 'User has already joined' })
  @ApiNotFoundResponse()
  reissue(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InviteResponseDto> {
    return this.users.reissueInvite(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Change a user's role" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Changing your own role' })
  @ApiConflictResponse({ description: 'Would demote the last admin' })
  @ApiNotFoundResponse()
  updateRole(
    @GetUser() actor: PayloadDto,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    return this.users.updateRole(actor.sub, id, dto.role);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove a user',
    description: 'Their session stops working on the next request.',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Removing yourself' })
  @ApiConflictResponse({ description: 'Would remove the last admin' })
  @ApiNotFoundResponse()
  async remove(
    @GetUser() actor: PayloadDto,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.users.remove(actor.sub, id);
  }
}
