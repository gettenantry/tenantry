import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createTenantRepository, type TenantBaseRepository } from '@tenantry/typeorm';
import { type DataSource } from 'typeorm';

import { createDataSource } from './database';
import { Project } from './project.entity';

/**
 * Owns the TypeORM DataSource and exposes the tenant-scoped repository:
 * every query on Project is automatically filtered by the current tenant
 * AND runs under the RLS session variable — controllers never mention
 * tenantId. Mirror of example-prisma's PrismaService.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly dataSource: DataSource = createDataSource();

  readonly projects: TenantBaseRepository<Project> = createTenantRepository(
    this.dataSource,
    Project,
    { isolation: 'hybrid' },
  );

  async onModuleInit(): Promise<void> {
    await this.dataSource.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.dataSource.destroy();
  }
}
