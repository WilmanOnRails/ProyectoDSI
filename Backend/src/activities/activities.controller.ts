import {
  Controller,
  ParseUUIDPipe,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service.js';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { QueryActivityDto } from './dto/query-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WriteAccessGuard } from '../auth/guards/write-access.guard.js';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) { }

  @Post()
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  create(@Body() createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(createActivityDto);
  }

  @Get()
  findAll(@Query() query: QueryActivityDto) {
    return this.activitiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  update(@Param('id') id: string, @Body() updateActivityDto: UpdateActivityDto) {
    return this.activitiesService.update(id, updateActivityDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }

  @Delete(':id/presupuesto-items/:itemId')
  removeFromPresupuesto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.activitiesService.removeFromPresupuesto(id, itemId);
  }
}
