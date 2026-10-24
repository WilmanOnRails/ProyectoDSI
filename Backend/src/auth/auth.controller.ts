import { Controller, Body, Post, HttpException, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {

    constructor(private authService: AuthService) { }
    @Post('login')
    async login(
        @Body() data: LoginDto
    ) {
        const usertoken = await this.authService.validateUser(data);

        if (!usertoken) throw new HttpException('Credenciales invalidas', HttpStatus.UNAUTHORIZED);

        return usertoken;
    }
}