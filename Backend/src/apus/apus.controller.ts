import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApusService } from './apus.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

@Controller('apus')
export class ApusController {
  constructor(private readonly apusService: ApusService) { }

  @Post()
  create(@Body() createApusDto: CreateApusDto) {
    return this.apusService.create(createApusDto);
  }

  @Get()
  findAll() {
    return this.apusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.apusService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateApusDto: UpdateApusDto) {
    return this.apusService.update(id, updateApusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.apusService.remove(id);
  }
}
