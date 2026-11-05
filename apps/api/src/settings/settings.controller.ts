import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';
import {
  GlobalSettingsResponseDto,
  SettingsResponseDto,
  UpdateGlobalSettingsDto,
  UpdateSettingsDto,
} from './dto/settings.dto';
import { Chain } from '@mintit/types';

@ApiTags('admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Missing or invalid session cookie',
})
@Controller('admin/settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('global')
  @ApiOperation({ summary: 'Get global settings' })
  @ApiOkResponse({ type: GlobalSettingsResponseDto })
  getGlobal(): GlobalSettingsResponseDto {
    return this.settings.getGlobal();
  }

  @Put('global')
  @ApiOperation({ summary: 'Update global settings (partial)' })
  @ApiOkResponse({ type: GlobalSettingsResponseDto })
  async updateGlobal(
    @Body() dto: UpdateGlobalSettingsDto,
  ): Promise<GlobalSettingsResponseDto> {
    return this.settings.updateGlobal(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get chain settings' })
  @ApiOkResponse({ type: SettingsResponseDto })
  get(@Query('chain') chain: Chain): SettingsResponseDto {
    return this.settings.getAll(chain);
  }

  @Put()
  @ApiOperation({ summary: 'Update chain settings (partial)' })
  @ApiOkResponse({ type: SettingsResponseDto })
  async update(
    @Query('chain') chain: Chain,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    return this.settings.update(chain, dto);
  }
}
