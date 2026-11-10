import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.forgotPassword(data.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() data: ResetPasswordDto) {
    return this.authService.resetPassword(data.token, data.password);
  }
}