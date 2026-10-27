import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {

  constructor(private prisma: PrismaService) { }

  create(createProjectDto: CreateProjectDto) {
    return this.prisma.proyecto.create({ data: createProjectDto });
  }

  findAll() {
    return this.prisma.proyecto.findMany();
  }

  findOne(id: string) {
    return this.prisma.proyecto.findUnique({
      where: { id }
    });
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    return this.prisma.proyecto.update({
      where: { id },
      data: updateProjectDto
    });
  }

  remove(id: string) {
    return this.prisma.proyecto.delete({
      where: { id }
    });
  }
}
