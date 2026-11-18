import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const userSelect = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  ultimoAcceso: true,
} satisfies Prisma.UsuarioSelect;

const roleLabels: Record<Rol, string> = {
  administrador: 'Administrador',
  presupuestista: 'Presupuestista',
  solo_lectura: 'Solo lectura',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(createUserDto.passwordHash, 10);
    return this.prisma.usuario.create({
      data: {
        nombre: createUserDto.nombre.trim(),
        email: createUserDto.email.trim().toLowerCase(),
        passwordHash,
      },
      select: userSelect,
    });
  }

  findAll() {
    return this.prisma.usuario.findMany({
      select: userSelect,
      orderBy: [{ activo: 'asc' }, { nombre: 'asc' }],
    });
  }

  findPending() {
    return this.prisma.usuario.findMany({
      where: { activo: false },
      select: userSelect,
      orderBy: { nombre: 'asc' },
    });
  }

  async approve(id: string, rol: Rol) {
    const pendingUser = await this.prisma.usuario.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!pendingUser) {
      throw new NotFoundException('El usuario solicitado no existe');
    }
    if (pendingUser.activo) {
      throw new ConflictException('El usuario ya tiene acceso a la plataforma');
    }
    if (rol === Rol.administrador) {
      throw new BadRequestException('No se puede asignar el rol de administrador.');
    }

    const activation = await this.prisma.usuario.updateMany({
      where: { id, activo: false },
      data: { activo: true, rol },
    });

    if (activation.count !== 1) {
      throw new ConflictException(
        'La solicitud ya fue atendida por otro administrador',
      );
    }

    if (!(await this.sendApprovalEmail(pendingUser, rol))) {
      try {
        const rollback = await this.prisma.usuario.updateMany({
          where: { id, activo: true, rol },
          data: { activo: false },
        });

        if (rollback.count !== 1) {
          throw new Error('No fue posible revertir la activación del usuario');
        }
      } catch (error: unknown) {
        this.logger.error(
          `No se pudo revertir la activación del usuario ${id}.`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException(
          'No se pudo enviar el correo ni revertir el acceso. Revisa el estado del usuario.',
        );
      }

      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de aprobación. La solicitud sigue pendiente.',
      );
    }

    return {
      message: 'El usuario fue aprobado y se le envió un correo de aviso.',
    };
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUserId?: string,
  ) {
    const cambiaRol = updateUserDto.rol !== undefined;
    const cambiaEstado = updateUserDto.activo !== undefined;

    if (updateUserDto.rol === Rol.administrador) {
      throw new BadRequestException('No se puede asignar el rol de administrador.');
    }

    // Un administrador no puede quitarse su propio rol ni desactivarse,
    // porque se quedaría sin forma de volver a entrar.
    if (id === currentUserId && (cambiaRol || updateUserDto.activo === false)) {
      throw new BadRequestException(
        'No podés cambiar tu propio rol ni desactivar tu propia cuenta.',
      );
    }

    const data: Prisma.UsuarioUpdateInput = {};

    if (updateUserDto.nombre !== undefined) {
      data.nombre = updateUserDto.nombre.trim();
    }
    if (updateUserDto.email !== undefined) {
      data.email = updateUserDto.email.trim().toLowerCase();
    }
    if (updateUserDto.passwordHash !== undefined) {
      data.passwordHash = await bcrypt.hash(updateUserDto.passwordHash, 10);
    }
    if (cambiaRol) {
      data.rol = updateUserDto.rol;
    }
    if (cambiaEstado) {
      data.activo = updateUserDto.activo;
    }

    return this.prisma.usuario.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  remove(id: string) {
    return this.prisma.usuario.delete({
      where: { id },
      select: userSelect,
    });
  }

  private async sendApprovalEmail(
    user: Pick<Prisma.UsuarioGetPayload<{ select: typeof userSelect }>, 'nombre' | 'email'>,
    rol: Rol,
  ): Promise<boolean> {
    try {
      const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
      const from = this.configService.getOrThrow<string>('EMAIL_FROM');
      const frontendUrl = new URL(
        this.configService.getOrThrow<string>('FRONTEND_URL'),
      );
      const loginUrl = new URL('/login', frontendUrl).toString();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: 'Tu cuenta fue aprobada - ProyectoDSI',
          html: `<p>Hola ${escapeHtml(user.nombre)},</p><p>Tu solicitud para acceder a ProyectoDSI fue aprobada.</p><p>Tu rol asignado es: <strong>${roleLabels[rol]}</strong>.</p><p><a href="${escapeHtml(loginUrl)}">Iniciar sesión</a></p>`,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Resend rechazó el correo de aprobación (HTTP ${response.status}).`,
        );
      }
      return response.ok;
    } catch (error: unknown) {
      this.logger.error(
        'No se pudo enviar el correo de aprobación.',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}
