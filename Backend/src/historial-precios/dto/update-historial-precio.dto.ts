import { PartialType } from '@nestjs/swagger';
import { CreateHistorialPrecioDto } from './create-historial-precio.dto.js';

export class UpdateHistorialPrecioDto extends PartialType(CreateHistorialPrecioDto) {}
