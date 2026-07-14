# Adapter comparison

One core, thin adapters, identical guarantees — that's the architectural bet of Tenantry. This page tracks how each adapter measures up.

|                                     | `@tenantry/prisma`                                                                                                         | `@tenantry/typeorm`                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Status                              | 🚧 v1 (pre-release, on `main`)                                                                                             | 📋 planned (v2)                      |
| Mechanism                           | Client extension (`$extends`)                                                                                              | Entity subscriber + base repository  |
| Row-level filtering (tenant column) | ✅ hybrid mode                                                                                                             | planned                              |
| RLS session binding                 | ✅ per-transaction `set_config`                                                                                            | planned (same `RlsSessionService`)   |
| RLS-only mode                       | ✅                                                                                                                         | planned                              |
| Schema-per-tenant                   | ❌ (not planned for Prisma)                                                                                                | planned (dynamic `search_path`)      |
| Global (non-tenant) models          | ✅ anything not in `models`                                                                                                | planned (explicit opt-out decorator) |
| Raw query protection                | ✅ RLS binding on `$queryRaw`/`$executeRaw`                                                                                | planned                              |
| Integration proof (Testcontainers)  | ✅ [isolation suite](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts) | planned (same scenario, shared spec) |
| Unit coverage on security paths     | 100%                                                                                                                       | same bar                             |

## The shared core

Whatever the adapter, these come from `@tenantry/core` and behave identically:

- `TenantContextService` / `runWithTenant` / `getCurrentTenantId`
- Extraction strategies and `TenancyModule.forRoot()`
- `TenancyGuard` + `@Public()`, `@CurrentTenant()`
- `RlsSessionService` — session binding SQL and policy DDL builders

Switching ORMs (or running both during a migration) does not change how your application code talks about tenants.
