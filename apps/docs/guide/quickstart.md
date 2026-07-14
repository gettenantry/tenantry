# Quickstart

From zero to tenant-isolated API in five steps. Prerequisites: NestJS 10/11, Prisma 5/6, PostgreSQL.

## 1. Install

```sh
pnpm add @tenantry/core @tenantry/prisma
```

## 2. Register the module and the guard

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenancyGuard, TenancyModule } from '@tenantry/core';

@Module({
  imports: [
    TenancyModule.forRoot({
      extraction: { strategy: 'header', header: 'x-tenant-id' },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: TenancyGuard }],
})
export class AppModule {}
```

Every request now runs inside a tenant context, and tenant-less requests get a 403 — except routes you mark with `@Public()`.

## 3. Extend your Prisma client

```ts
// prisma.service.ts
import { PrismaClient } from '@prisma/client';
import { createTenancyExtension } from '@tenantry/prisma';

export const prisma = new PrismaClient().$extends(
  createTenancyExtension({
    models: ['Project'], // your tenant-aware models
  }),
);
```

Every operation on `Project` is now scoped to the current tenant — reads are filtered, creates are stamped, and the RLS session variable is bound per transaction.

## 4. Add the tenant column and the RLS policy

```sql
ALTER TABLE "Project" ADD COLUMN "tenantId" TEXT NOT NULL;

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "Project"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));
```

::: warning Connect as a non-superuser
PostgreSQL superusers bypass RLS entirely. Run migrations as an admin role, but point your application at a regular role (`GRANT SELECT, INSERT, UPDATE, DELETE …`). The [example app](/examples) shows the two-URL setup.
:::

## 5. Write controllers that never mention tenants

```ts
@Controller('projects')
export class ProjectsController {
  @Get()
  list() {
    return prisma.project.findMany(); // scoped automatically
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentTenant() tenant: string) {
    // tenant is available if you need it — filtering happens regardless
    return prisma.project.findUnique({ where: { id } });
  }
}
```

That's it. Try it with two different `x-tenant-id` headers and watch each tenant live in its own world — then read [Isolation & RLS](/guide/concepts/isolation) to understand exactly what protects you when application code goes wrong.
