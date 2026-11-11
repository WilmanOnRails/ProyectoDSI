import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();

    if (request.user?.role !== 'administrador') {
      throw new ForbiddenException('Solo un administrador puede gestionar usuarios');
    }

    return true;
  }
}
