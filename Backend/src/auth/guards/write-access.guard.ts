import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class WriteAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();
    const role = request.user?.role;

    if (role !== 'administrador' && role !== 'presupuestista') {
      throw new ForbiddenException(
        'Tu rol no permite modificar información en la plataforma',
      );
    }

    return true;
  }
}
