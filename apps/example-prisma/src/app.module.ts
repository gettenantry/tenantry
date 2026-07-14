import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenancyGuard, TenancyModule } from '@tenantry/core';

import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [
    // Every request's tenant comes from the x-tenant-id header. Swap the
    // strategy for 'jwt' or 'subdomain' without touching anything else.
    TenancyModule.forRoot({
      extraction: { strategy: 'header', header: 'x-tenant-id' },
    }),
  ],
  controllers: [HealthController, ProjectsController],
  providers: [
    PrismaService,
    // Tenant-less requests are rejected everywhere by default;
    // routes marked @Public() (see HealthController) opt out explicitly.
    { provide: APP_GUARD, useClass: TenancyGuard },
  ],
})
export class AppModule {}
