import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WebhookDeliveryStatus,
  WebhookEvent,
} from '../schemas/webhook-delivery.entity';

export class WebhookAttemptDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'The webhook ID: used in creation of an invoice',
  })
  id!: string;

  @ApiProperty({ enum: WebhookEvent, example: WebhookEvent.InvoiceConfirmed })
  event!: WebhookEvent;

  @ApiProperty({
    enum: WebhookDeliveryStatus,
    example: WebhookDeliveryStatus.Pending,
  })
  status!: WebhookDeliveryStatus;

  @ApiProperty({
    example: 0,
    description: 'Number of attempts at delivering webhook',
  })
  attempts!: number;

  @ApiPropertyOptional({
    example: 404,
    description: 'Response code from delivery attempt',
  })
  lastResponseCode?: number;

  @ApiPropertyOptional({
    example: 'Invoice not found',
    description: 'Response error message',
  })
  lastError?: string;

  @ApiProperty({
    example: '2026-05-06T12:34:56.000Z',
    description: 'Time of next attempted webhook delivery',
  })
  nextAttemptAt!: string;

  @ApiProperty({ example: '2026-05-06T12:34:56.000Z' })
  updatedAt!: string;

  @ApiProperty({ example: '2026-05-06T12:34:56.000Z' })
  createdAt!: string;
}
