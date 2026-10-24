import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ required: true, example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ required: true, example: 'correoEjemplo@gmail.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ required: true, example: 'contra123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    passwordHash: string;
}
