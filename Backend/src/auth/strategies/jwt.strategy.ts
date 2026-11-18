import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Leemos el usuario en la base en cada request para que un cambio de rol o
   * de estado (activar/desactivar) se aplique de inmediato, sin esperar a que
   * venza el token.
   */
  async validate(payload: { id: string; email: string; role: string }) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { activo: true, rol: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Tu cuenta no está activa');
    }

    return {
      userId: payload.id,
      email: payload.email,
      role: usuario.rol,
    };
  }
}
