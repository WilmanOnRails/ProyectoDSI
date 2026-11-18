import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService.refresh', () => {
  const usuario = {
    id: 'user-id',
    nombre: 'Ana',
    email: 'ana@example.com',
    rol: 'presupuestista',
    activo: true,
  };

  let registro: Record<string, unknown>;
  let revoke: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let logoutRevoke: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;
  let signAsync: ReturnType<typeof vi.fn>;
  let prisma: Record<string, unknown>;
  let service: AuthService;

  beforeEach(() => {
    registro = {
      id: 'refresh-id',
      usuarioId: usuario.id,
      tokenHash: 'hash-del-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      usuario,
    };
    revoke = vi.fn().mockResolvedValue({ count: 1 });
    create = vi.fn().mockResolvedValue({});
    logoutRevoke = vi.fn().mockResolvedValue({ count: 1 });
    findUnique = vi.fn().mockResolvedValue(registro);
    signAsync = vi.fn().mockResolvedValue('access-token-nuevo');

    const transaction = {
      refreshToken: { updateMany: revoke, create },
    };
    prisma = {
      refreshToken: { findUnique, updateMany: logoutRevoke },
      $transaction: vi.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const config = {
      get: vi.fn().mockReturnValue('30'),
    } as unknown as ConfigService;
    service = new AuthService(
      { signAsync } as unknown as JwtService,
      prisma as unknown as PrismaService,
      config,
    );
  });

  it('renueva el access token y rota el refresh token', async () => {
    const token = 'refresh-token-original';
    const respuesta = await service.refresh(token);

    expect(respuesta.access_token).toBe('access-token-nuevo');
    expect(respuesta.user).toEqual({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    });
    expect(respuesta.refresh_token).toBeDefined();
    expect(respuesta.refresh_token).not.toBe(token);

    // El token usado se revoca y se guarda solo el hash del nuevo.
    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: registro.id, revokedAt: null },
      }),
    );
    const guardado = create.mock.calls[0][0].data;
    expect(guardado.tokenHash).not.toBe(respuesta.refresh_token);
    expect(guardado.usuarioId).toBe(usuario.id);
  });

  it('rechaza un token revocado', async () => {
    registro.revokedAt = new Date();

    await expect(service.refresh('token-usado')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revoke).not.toHaveBeenCalled();
  });

  it('rechaza un token vencido', async () => {
    registro.expiresAt = new Date(Date.now() - 1000);

    await expect(service.refresh('token-vencido')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revoke).not.toHaveBeenCalled();
  });

  it('rechaza la renovación si la cuenta está inactiva', async () => {
    (registro.usuario as { activo: boolean }).activo = false;

    await expect(service.refresh('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revoke).not.toHaveBeenCalled();
  });

  it('revoca la sesión al cerrar sesión', async () => {
    await expect(service.logout('token-a-revocar')).resolves.toEqual({
      message: 'Sesión cerrada correctamente.',
    });
    expect(logoutRevoke).toHaveBeenCalled();
  });
});
