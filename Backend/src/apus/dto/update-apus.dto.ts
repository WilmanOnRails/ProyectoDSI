import { PartialType } from '@nestjs/swagger';
import { CreateApusDto } from './create-apus.dto.js';

export class UpdateApusDto extends PartialType(CreateApusDto) {}
