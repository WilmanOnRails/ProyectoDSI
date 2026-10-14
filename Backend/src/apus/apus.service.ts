import { Injectable } from '@nestjs/common';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ApusService {

  constructor(private prisma: PrismaService) { }

  create(createApusDto: CreateApusDto) {
    return this.prisma.apuDetalle.create({ data: createApusDto });
  }

  findAll() {
    return this.prisma.apuDetalle.findMany();
  }

  findOne(id: string) {
    return this.prisma.apuDetalle.findUnique({
      where: { id }
    });
  }

  update(id: string, updateApusDto: UpdateApusDto) {
    return this.prisma.apuDetalle.update({
      where: { id },
      data: updateApusDto
    });
  }

  remove(id: string) {
    return this.prisma.apuDetalle.delete({
      where: { id }
    });
  }
}
