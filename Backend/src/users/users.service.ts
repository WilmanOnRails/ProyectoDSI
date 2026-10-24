import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {

  constructor(private prisma: PrismaService) { }

  async create(createUserDto: CreateUserDto) {

    const hashedPassword = await bcrypt.hash(
      createUserDto.passwordHash,
      10,
    );
    return this.prisma.usuario.create({ data: { ...createUserDto, passwordHash: hashedPassword } });
  }

  findAll() {
    return this.prisma.usuario.findMany();
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id }
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;

  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.usuario.update(
      {
        where: { id },
        data: updateUserDto
      }
    )
  }

  remove(id: string) {
    return this.prisma.usuario.delete({
      where: { id }
    });
  }
}
