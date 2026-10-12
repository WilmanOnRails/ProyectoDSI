import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService) { }

    async validateUser(user: LoginDto) {
        const foundUser = await this.prisma.usuario.findUnique({
            where: {
                email: user.email
            }
        });
        if (!foundUser) return null;

        const isPasswordValid = await bcrypt.compare(user.password, foundUser.passwordHash);

        if (isPasswordValid) {
            return this.jwtService.sign({
                id: foundUser.id,
                email: foundUser.email,
                role: foundUser.rol,
            });
        } else {
            throw new UnauthorizedException('Credenciales inválidas');
        }
    }
}
