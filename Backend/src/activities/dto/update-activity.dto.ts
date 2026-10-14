import { PartialType } from '@nestjs/swagger';
import { CreateActivityDto } from './create-activity.dto.js';

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}
