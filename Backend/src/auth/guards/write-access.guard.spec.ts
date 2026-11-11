import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { WriteAccessGuard } from './write-access.guard.js';

function contextForRole(role?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as ExecutionContext;
}

describe('WriteAccessGuard', () => {
  const guard = new WriteAccessGuard();

  it.each(['administrador', 'presupuestista'])(
    'permite escrituras al rol %s',
    (role) => {
      expect(guard.canActivate(contextForRole(role))).toBe(true);
    },
  );

  it.each(['solo_lectura', 'ingeniero', undefined])(
    'rechaza escrituras al rol %s',
    (role) => {
      expect(() => guard.canActivate(contextForRole(role))).toThrow(
        ForbiddenException,
      );
    },
  );
});
