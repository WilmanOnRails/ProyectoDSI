import { Global, Module } from '@nestjs/common';
import { WriteAccessGuard } from './guards/write-access.guard.js';

@Global()
@Module({
  providers: [WriteAccessGuard],
  exports: [WriteAccessGuard],
})
export class AccessControlModule {}
