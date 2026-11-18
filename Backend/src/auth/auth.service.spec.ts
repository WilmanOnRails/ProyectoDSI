import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { AuthService } from './auth.service.js';

describe('AuthService.updateProfile', () => {
  const storedUser = {
    id: 'user-id',
    nombre: 'Nombre anterior',
    email: 'anterior@example.com',
    passwordHash: '',
    rol: 'presupuestista',
  };
  let prisma: {
    usuario: { findUnique: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let update: ReturnType<typeof vi.fn>;
  let deleteResetTokens: ReturnType<typeof vi.fn>;
  let service: AuthService;

  beforeEach(async () => {
    storedUser.passwordHash = await bcrypt.hash('password-actual', 4);
    update = vi.fn().mockResolvedValue({
      id: storedUser.id,
      nombre: 'Nombre nuevo',
      email: 'nuevo@example.com',
      rol: storedUser.rol,
    });
    deleteResetTokens = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      usuario: { update },
      passwordResetToken: { deleteMany: deleteResetTokens },
    };
    prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValue(storedUser),
      },
      $transaction: vi.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    service = new AuthService(
      {} as JwtService,
      prisma as unknown as PrismaService,
      {} as ConfigService,
    );
  });

  it('updates profile fields and clears reset tokens when changing password', async () => {
    const data = {
      nombre: 'Nombre nuevo',
      email: 'nuevo@example.com',
      currentPassword: 'password-actual',
      newPassword: 'password-nuevo',
    } as UpdateProfileDto;

    await expect(service.updateProfile(storedUser.id, data)).resolves.toEqual({
      id: storedUser.id,
      nombre: 'Nombre nuevo',
      email: 'nuevo@example.com',
      rol: storedUser.rol,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: storedUser.id },
        data: expect.objectContaining({
          nombre: data.nombre,
          email: data.email,
        }),
      }),
    );
    const savedPasswordHash = update.mock.calls[0][0].data.passwordHash as string;
    await expect(bcrypt.compare(data.newPassword!, savedPasswordHash)).resolves.toBe(
      true,
    );
    expect(deleteResetTokens).toHaveBeenCalledWith({
      where: { usuarioId: storedUser.id },
    });
  });

  it('rejects profile changes when the current password is incorrect', async () => {
    await expect(
      service.updateProfile(storedUser.id, {
        nombre: 'Nombre nuevo',
        currentPassword: 'incorrecta',
      } as UpdateProfileDto),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
