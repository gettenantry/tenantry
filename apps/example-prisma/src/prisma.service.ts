import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenancyExtension } from '@tenantry/prisma';

function createClient() {
  return new PrismaClient({
    // The app connects as a NON-superuser role so RLS applies (see
    // prisma/migrations/0_init/migration.sql and .env.example).
    datasourceUrl:
      process.env['APP_DATABASE_URL'] ??
      'postgresql://app_user:app_password@localhost:5432/tenantry_example',
  }).$extends(
    createTenancyExtension({
      models: ['Project'],
      isolation: 'hybrid',
    }),
  );
}

export type TenantScopedPrisma = ReturnType<typeof createClient>;

/**
 * Exposes a tenant-scoped Prisma client: every query on `Project` is
 * automatically filtered by the current tenant AND runs under the RLS
 * session variable — controllers never mention tenantId.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: TenantScopedPrisma = createClient();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
