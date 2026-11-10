import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { LoginDto } from './dto/login.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';

const passwordResetRequestMessage =
  'Si existe una cuenta activa con ese correo, recibirás instrucciones para recuperar tu contraseña.';

export interface AuthenticatedUser {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(credentials: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.usuario.findUnique({
      where: { email: credentials.email },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const passwordMatches = await bcrypt.compare(
      credentials.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const accessToken = await this.jwtService.signAsync({
      id: user.id,
      email: user.email,
      role: user.rol,
    });

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    const from = this.configService.getOrThrow<string>('EMAIL_FROM');
    const frontendUrl = new URL(
      this.configService.getOrThrow<string>('FRONTEND_URL'),
    );
    const user = await this.prisma.usuario.findUnique({ where: { email } });

    if (!user || !user.activo) {
      return { message: passwordResetRequestMessage };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({
        where: { usuarioId: user.id },
      });
      await transaction.passwordResetToken.create({
        data: { usuarioId: user.id, tokenHash, expiresAt },
      });
    });

    const resetUrl = new URL('/recuperar-contrasena', frontendUrl);
    resetUrl.searchParams.set('token', token);

    let emailSent = false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: 'Recuperación de contraseña - ProyectoDSI',
          html: `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p><p><a href="${resetUrl.toString()}">Crear una contraseña nueva</a></p><p>El enlace vence en una hora. Si no solicitaste este cambio, puedes ignorar este correo.</p>`,
        }),
      });

      emailSent = response.ok;
      if (!emailSent) {
        this.logger.error(
          `Resend rechazó el correo de recuperación (HTTP ${response.status}).`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        'No se pudo conectar con Resend para enviar el correo de recuperación.',
        error instanceof Error ? error.stack : String(error),
      );
    }

    if (!emailSent) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      });
    }

    return { message: passwordResetRequestMessage };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.expiresAt <= new Date()) {
      throw new BadRequestException(
        'El enlace de recuperación no es válido o venció. Solicita uno nuevo.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    try {
      await this.prisma.$transaction(async (transaction) => {
        const consumedToken = await transaction.passwordResetToken.deleteMany({
          where: {
            id: resetToken.id,
            tokenHash,
            expiresAt: { gt: now },
          },
        });

        if (consumedToken.count !== 1) {
          throw new BadRequestException(
            'El enlace de recuperación no es válido o venció. Solicita uno nuevo.',
          );
        }

        await transaction.usuario.update({
          where: { id: resetToken.usuarioId },
          data: { passwordHash },
        });
        await transaction.passwordResetToken.deleteMany({
          where: { usuarioId: resetToken.usuarioId },
        });
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        'No se pudo actualizar la contraseña en la base de datos.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No fue posible actualizar la contraseña. Intenta de nuevo.',
      );
    }

    return { message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }
}
