import { Controller, Get } from '@nestjs/common';
import { Public } from '@tenantry/core';

@Controller('health')
export class HealthController {
  /** Explicitly public: reachable without a tenant (probes, load balancers). */
  @Public()
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
