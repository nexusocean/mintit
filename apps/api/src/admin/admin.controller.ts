import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
  ApiBadRequestResponse,
  ApiServiceUnavailableResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from '../settings/settings.service';
import { InvoiceDefaultsResponseDto } from './dto/invoice-defaults.dto';
import { WalletInfoResponseDto } from './dto/wallet-info.dto';
import {
  InvoiceListQueryDto,
  InvoiceListResponseDto,
} from './dto/invoice-list.dto';
import { StatsResponseDto } from './dto/wallet-stats.dto';
import { Chain, UserScope } from '@mintit/types';
import { InvoiceResponseDto } from '../invoices/dto/invoice-response.dto';
import { CreateInvoiceDto } from '../invoices/dto/create-invoice.dto';

@ApiTags('admin')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Missing or invalid session cookie',
})
@ApiForbiddenResponse({ description: 'Role not allowed' })
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
// Admin-only unless a route opens itself to managers, so new routes default
// to the stricter role.
@Roles(UserScope.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: SettingsService,
  ) {}

  // Admin only: the response includes the private view key, which reveals
  // every incoming payment and can't be rotated without a new wallet.
  @Get('wallet')
  @ApiOperation({ summary: 'Get wallet info (admin only)' })
  @ApiQuery({ name: 'chain', enum: Chain, required: false })
  @ApiOkResponse({ type: WalletInfoResponseDto })
  getInfo(
    @Query('chain') chain: Chain = Chain.Xmr,
  ): Promise<WalletInfoResponseDto> {
    return this.admin.getWalletInfo(chain);
  }

  @Roles(UserScope.ADMIN, UserScope.MANAGER)
  @Get('stats')
  @ApiOperation({ summary: 'Get stats' })
  @ApiQuery({ name: 'chain', enum: Chain, required: false })
  @ApiOkResponse({ type: StatsResponseDto })
  async getStats(
    @Query('chain') chain: Chain = Chain.Xmr,
  ): Promise<StatsResponseDto> {
    return this.admin.getStats(chain);
  }

  @Roles(UserScope.ADMIN, UserScope.MANAGER)
  @Get('invoices')
  @ApiOperation({
    summary: 'List invoices',
    description: 'Omit chain to list invoices across all enabled chains',
  })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  listInvoices(
    @Query() query: InvoiceListQueryDto,
  ): Promise<InvoiceListResponseDto> {
    return this.admin.listInvoices(query);
  }

  // Declared before invoices/:publicId so "defaults" isn't read as an ID.
  @Roles(UserScope.ADMIN, UserScope.MANAGER)
  @Get('invoices/defaults')
  @ApiOperation({
    summary: 'Get the default expiry and confirmations for a new invoice',
  })
  @ApiQuery({ name: 'chain', enum: Chain, required: false })
  @ApiOkResponse({ type: InvoiceDefaultsResponseDto })
  getInvoiceDefaults(
    @Query('chain') chain: Chain = Chain.Xmr,
  ): InvoiceDefaultsResponseDto {
    const { invoiceDefaultExpirySec, confirmationDepth } =
      this.settings.getAll(chain);
    return { invoiceDefaultExpirySec, confirmationDepth };
  }

  @Roles(UserScope.ADMIN, UserScope.MANAGER)
  @Get('invoices/:publicId')
  @ApiOperation({ summary: 'Get invoice by public ID' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  getInvoice(
    @Param('publicId', new ParseUUIDPipe({ version: '4' }))
    publicId: string,
  ): Promise<InvoiceResponseDto> {
    return this.admin.getInvoice(publicId);
  }

  @Roles(UserScope.ADMIN, UserScope.MANAGER)
  @Post('invoices')
  @ApiOperation({ summary: 'Create invoice (admin-created)' })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error',
  })
  @ApiServiceUnavailableResponse({ description: 'Price feed unavailable' })
  createInvoice(@Body() dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    return this.admin.createInvoice(dto);
  }
}
