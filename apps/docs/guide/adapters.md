# Adapter comparison

One core, thin adapters, identical guarantees — that's the architectural bet of Tenantry, and the [cross-adapter parity suite](https://github.com/gettenantry/tenantry/blob/main/tests/parity/test/integration/parity.spec.ts) enforces it: the same isolation scenario runs against both adapters and must produce identical outcomes.

|                                     | `@tenantry/prisma`                                                                                                         | `@tenantry/typeorm`                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Status                              | 🚧 v1 (pre-release)                                                                                                        | 🚧 v1 (pre-release)                                                                                                         |
| Mechanism                           | Client extension (`$extends`)                                                                                              | Entity subscriber + base repository                                                                                         |
| Row-level filtering (tenant column) | ✅ hybrid mode                                                                                                             | ✅ hybrid mode                                                                                                              |
| RLS session binding                 | ✅ per-transaction `set_config`                                                                                            | ✅ per-transaction `set_config`                                                                                             |
| RLS-only mode                       | ✅                                                                                                                         | ✅                                                                                                                          |
| Schema-per-tenant                   | ❌ (not planned for Prisma)                                                                                                | ✅ dynamic `search_path`                                                                                                    |
| Global (non-tenant) models          | ✅ anything not in `models`                                                                                                | ✅ `@GlobalEntity()` / not `@TenantAware()`                                                                                 |
| Raw query protection                | ✅ RLS binding on `$queryRaw`/`$executeRaw`                                                                                | ✅ RLS covers `query()`/query builder                                                                                       |
| Write enforcement                   | filter + stamped `create` data                                                                                             | `TenantSubscriber` (stamp + cross-tenant refusal)                                                                           |
| Integration proof (Testcontainers)  | ✅ [isolation suite](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts) | ✅ [isolation suite](https://github.com/gettenantry/tenantry/blob/main/packages/typeorm/test/integration/isolation.spec.ts) |
| Unit coverage on security paths     | 100%                                                                                                                       | 100%                                                                                                                        |

## The same code, two ORMs

The controller is identical whatever the adapter — no `tenantId`, no filtering logic:

::: code-group

```ts [Prisma]
@Get()
list() {
  return this.prisma.project.findMany();
}

@Post()
create(@Body() dto: CreateDto, @CurrentTenant() tenant: string) {
  return this.prisma.project.create({ data: { name: dto.name, tenantId: tenant } });
}
```

```ts [TypeORM]
@Get()
list() {
  return this.projects.find();
}

@Post()
create(@Body() dto: CreateDto) {
  return this.projects.save({ name: dto.name }); // subscriber stamps the tenant
}
```

:::

Both back the same `Project` table and pass the same [parity assertions](https://github.com/gettenantry/tenantry/blob/main/tests/parity/test/integration/parity.spec.ts). See the runnable demos: [`example-prisma`](https://github.com/gettenantry/tenantry/tree/main/apps/example-prisma) and [`example-typeorm`](https://github.com/gettenantry/tenantry/tree/main/apps/example-typeorm).

## The shared core

Whatever the adapter, these come from `@tenantry/core` and behave identically:

- `TenantContextService` / `runWithTenant` / `getCurrentTenantId`
- Extraction strategies and `TenancyModule.forRoot()`
- `TenancyGuard` + `@Public()`, `@CurrentTenant()`
- `RlsSessionService` — session binding SQL and policy DDL builders

Switching ORMs (or running both during a migration) does not change how your application code talks about tenants.
