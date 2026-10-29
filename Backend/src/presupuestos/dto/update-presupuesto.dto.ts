import { PartialType } from '@nestjs/swagger';
import { CreatePresupuestoDto } from './create-presupuesto.dto.js';

export class UpdatePresupuestoDto extends PartialType(CreatePresupuestoDto) {
  /** El proyectoId no debe cambiarse después de crear el presupuesto. */
  proyectoId?: never;
}
