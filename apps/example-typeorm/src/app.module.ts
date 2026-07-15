import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenancyGuard, TenancyModule } from '@tenantry/core';

import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [
    // Identical configuration to example-prisma — the core API does not
    // change with the ORM. That's the point.
    TenancyModule.forRoot({
      extraction: { strategy: 'header', header: 'x-tenant-id' },
    }),
  ],
  controllers: [HealthController, ProjectsController],
  providers: [DatabaseService, { provide: APP_GUARD, useClass: TenancyGuard }],
})
export class AppModule {}
