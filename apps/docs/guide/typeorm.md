# TypeORM adapter

`@tenantry/typeorm` brings tenant isolation to [TypeORM](https://typeorm.io): a subscriber that enforces the tenant boundary on writes, a repository that scopes reads, and **three isolation strategies** — including schema-per-tenant, which no other NestJS multi-tenancy library offers alongside RLS.

It reuses the exact same `@tenantry/core` as the Prisma adapter, so `TenancyModule`, `@CurrentTenant()`, `TenancyGuard` and the extraction strategies are identical no matter which ORM you pick.

## Setup

```ts
import { DataSource } from 'typeorm';
import { createTenantSubscriber, createTenantRepository, TenantAware } from '@tenantry/typeorm';

@TenantAware()
@Entity()
export class Project {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() tenantId!: string;
  @Column() name!: string;
}

const dataSource = new DataSource({ /* ... */ entities: [Project] });
dataSource.subscribers.push(createTenantSubscriber());
await dataSource.initialize();

const projects = createTenantRepository(dataSource, Project, { isolation: 'hybrid' });

await runWithTenant('acme', async () => projects.find()); // scoped to acme
```

The `TenantBaseRepository` returned by `createTenantRepository` is a real `Repository<Project>` — every method you know works, the tenant-aware ones just enforce the boundary.

## Classifying entities

| Approach                       | How                                                                      |
| ------------------------------ | ------------------------------------------------------------------------ |
| `@TenantAware()` (default)     | Decorate each tenant-scoped entity. Everything else is global.           |
| `entities: 'all'`              | Every entity is tenant-scoped **except** those marked `@GlobalEntity()`. |
| `entities: [Project, Invoice]` | Explicit allow-list.                                                     |

```ts
@GlobalEntity()
@Entity()
export class Country {
  /* never filtered — countries, plans, feature flags… */
}
```

`@GlobalEntity()` always wins over `@TenantAware()` and the `'all'` mode — the escape hatch can never be overridden by accident.

## Isolation strategies

```ts
createTenantRepository(dataSource, Project, {
  isolation: 'hybrid', // 'hybrid' | 'rls-only' | 'schema-per-tenant'
  tenantColumn: 'tenantId', // default; per-entity override via @TenantAware({ column })
  sessionVariable: 'app.current_tenant', // or false (hybrid only, discouraged)
  onMissingTenant: 'throw', // 'throw' | 'passthrough'
});
```

### hybrid (default)

Reads get the tenant merged into every `where`; writes are stamped and checked by the subscriber; and each operation runs in a transaction that binds the RLS session variable. Defense in depth: a forgotten filter, a raw query, or a smuggled `tenantId` are all caught — by the app layer, the database, or both.

### rls-only

No application filter. The PostgreSQL policy is the single source of truth; the adapter only binds the session variable. Leaner, but every access path must go through RLS-protected tables.

### schema-per-tenant

Each tenant lives in its own PostgreSQL schema. Before each operation the adapter binds `search_path` to `tenant_<id>,public` (parameterized, transaction-local). No tenant column, no filter — the schema _is_ the boundary.

```ts
createTenantRepository(dataSource, Note, {
  isolation: 'schema-per-tenant',
  schema: {
    naming: (t) => `tenant_${t}`, // must yield [a-z_][a-z0-9_]*
    sharedSchemas: ['public'], // appended after the tenant schema
  },
});
```

You are responsible for creating each tenant's schema and running migrations across them; Tenantry handles the routing.

## Write enforcement (the subscriber)

`TenantSubscriber` is where writes are made safe:

- **insert** → stamps the tenant column from the context, overwriting any client-supplied value;
- **update** → refuses to touch a row owned by another tenant, and refuses to rebind the tenant column (throws `CrossTenantOperationError`);
- **remove** → refuses to remove another tenant's row.

It's a no-op for global entities and in schema-per-tenant mode (where the schema already isolates writes). Register it once per DataSource.

## Proven, like Prisma

The [TypeORM integration suite](https://github.com/gettenantry/tenantry/blob/main/packages/typeorm/test/integration/isolation.spec.ts) runs all three strategies against a real PostgreSQL, including the deliberate-bug scenario. And a [cross-adapter parity suite](https://github.com/gettenantry/tenantry/blob/main/tests/parity/test/integration/parity.spec.ts) runs _the same_ isolation scenario against both Prisma and TypeORM, asserting identical outcomes — so the two adapters can never silently diverge in what "isolated" means.

## Known limitations

- **`createQueryBuilder` and raw `query()`** are not filtered at the application level (TypeORM gives no hook for it). In hybrid/rls-only modes the RLS policy still covers them; in a pure application-filter setup, add the tenant condition yourself.
- **Composite primary keys**: id-based criteria (`delete('42')`) require a single primary column. Pass an explicit `where` object for composite keys.
- **User-managed transactions**: operations get their own binding transaction; joining an outer `dataSource.transaction()` is planned.
