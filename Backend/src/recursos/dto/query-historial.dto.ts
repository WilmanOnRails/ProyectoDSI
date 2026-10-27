import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryHistorialDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha desde (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha hasta (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
