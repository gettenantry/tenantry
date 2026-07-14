# Prisma adapter

`@tenantry/prisma` scopes your Prisma client to the current tenant through a [client extension](https://www.prisma.io/docs/orm/prisma-client/client-extensions) — no schema changes beyond the tenant column, no code generation, no wrapper class.

## Setup

```ts
import { PrismaClient } from '@prisma/client';
import { createTenancyExtension } from '@tenantry/prisma';

const prisma = new PrismaClient().$extends(
  createTenancyExtension({
    models: ['Project', 'Invoice'], // or 'all'
  }),
);
```

In NestJS, wrap it in a provider (see the [example app](/examples) for the full pattern):

```ts
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL }).$extends(
    createTenancyExtension({ models: ['Project'] }),
  );

  onModuleInit() {
    return this.client.$connect();
  }
  onModuleDestroy() {
    return this.client.$disconnect();
  }
}
```

## Options

```ts
createTenancyExtension({
  models: ['Project'], // tenant-aware models ('all' covers everything)
  tenantField: 'tenantId', // column name, default 'tenantId'
  isolation: 'hybrid', // 'hybrid' | 'rls-only'
  sessionVariable: 'app.current_tenant', // or false to skip RLS binding (hybrid only, discouraged)
  onMissingTenant: 'throw', // 'throw' | 'passthrough'
  getTenantId: undefined, // custom resolver; defaults to the core ALS context
});
```

Models **not** listed are global: their queries pass through untouched (`countries`, `plans`, feature flags…). Fail-safe note: if you accidentally leave an RLS policy on a model you marked global, the database still filters it — misconfiguration degrades to _less data_, never _more_.

## What the extension does per operation

| Operation family                                                                                         | `hybrid`                                                                      | `rls-only`       |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| `findMany`, `findFirst(OrThrow)`, `count`, `aggregate`, `groupBy`, `updateMany(AndReturn)`, `deleteMany` | `where` AND-merged with `{ tenantField: tenant }`                             | untouched        |
| `findUnique(OrThrow)`, `update`, `delete`                                                                | tenant merged into the unique selector (attacker-supplied values overwritten) | untouched        |
| `create`, `createMany(AndReturn)`                                                                        | `data` stamped with the tenant (row by row for lists)                         | untouched        |
| `upsert`                                                                                                 | selector scoped + `create` branch stamped                                     | untouched        |
| `$queryRaw(Unsafe)`, `$executeRaw(Unsafe)`                                                               | RLS binding only (SQL can't be filtered)                                      | RLS binding only |
| Unknown / future operations                                                                              | **throws `UnsupportedOperationError`** — fails closed                         | untouched        |

In **both** modes (unless `sessionVariable: false`), each operation runs inside a batch transaction:

```
BEGIN → SELECT set_config('app.current_tenant', tenant, true) → your query → COMMIT
```

which guarantees the binding and the query share one pooled connection, and the binding dies with the transaction.

## Missing tenant

By default, any operation on a tenant-aware model with no tenant in context throws `MissingTenantError` — loud and early. Set `onMissingTenant: 'passthrough'` only if you have code paths that legitimately run tenant-less (and remember: with RLS in place, passthrough queries see an empty table, not everyone's data).

## Known v1 limitations

- **User-managed interactive transactions**: operations inside your own `prisma.$transaction(async (tx) => …)` get their own RLS-binding transaction rather than joining yours. Planned for a future release.
- **Create typings**: the generated Prisma types still require `tenantId` in `create` even though `hybrid` mode stamps it. Pass it from `@CurrentTenant()` (the extension enforces it matches the context anyway) — see [the example controller](https://github.com/gettenantry/tenantry/blob/main/apps/example-prisma/src/projects.controller.ts).
- **Nested relation writes** on tenant-aware models are not individually stamped; keep tenant-aware creations top-level, or rely on RLS `WITH CHECK` to reject mistakes.
