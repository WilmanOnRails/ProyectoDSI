import { Injectable } from '@nestjs/common';
import { CreateHistorialPrecioDto } from './dto/create-historial-precio.dto.js';
import { UpdateHistorialPrecioDto } from './dto/update-historial-precio.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HistorialPreciosService {
  constructor(private prisma: PrismaService) { }

  create(createHistorialPrecioDto: CreateHistorialPrecioDto) {
    return this.prisma.historialPrecio.create({ data: createHistorialPrecioDto });
  }

  findAll() {
    return this.prisma.historialPrecio.findMany();
  }

  findOne(id: string) {
    return this.prisma.historialPrecio.findUnique(
      { where: { id } }
    );
  }

  update(id: string, updateHistorialPrecioDto: UpdateHistorialPrecioDto) {
    return this.prisma.historialPrecio.update(
      {
        where: { id },
        data: updateHistorialPrecioDto
      });;
  }

  remove(id: string) {
    return this.prisma.historialPrecio.delete(
      { where: { id } }
    );;
  }
}
