import { Injectable } from '@nestjs/common';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ActivitiesService {

  constructor(private prisma: PrismaService) { }

  create(createActivityDto: CreateActivityDto) {
    return this.prisma.actividad.create({ data: createActivityDto });
  }

  findAll() {
    return this.prisma.actividad.findMany();
  }

  findOne(id: string) {
    return this.prisma.actividad.findUnique(
      { where: { id } }
    );
  }

  update(id: string, updateActivityDto: UpdateActivityDto) {
    return this.prisma.actividad.update(
      {
        where: { id },
        data: updateActivityDto
      });
  }

  remove(id: string) {
    return this.prisma.actividad.delete(
      { where: { id } }
    );
  }
}
