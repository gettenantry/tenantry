---
'@tenantry/typeorm': minor
---

Initial release of the TypeORM adapter.

- **`TenantSubscriber`** — enforces the tenant boundary on writes: stamps the tenant column on insert (overriding smuggled values), and refuses cross-tenant updates/removes and tenant-column rebinding (`CrossTenantOperationError`).
- **`TenantBaseRepository`** — a real `Repository<T>` whose reads (`find*`, `count*`, `exists*`) and criteria writes (`update`, `delete`) are scoped to the current tenant.
- **Three isolation strategies**: `hybrid` (tenant filter + RLS, default), `rls-only`, and **`schema-per-tenant`** (dynamic `search_path` per operation) — the last of which no other NestJS multi-tenancy library offers alongside RLS.
- **Entity classification** via `@TenantAware()` / `@GlobalEntity()`, or `entities: 'all' | 'decorated' | [...]`. `@GlobalEntity()` always wins, so shared tables (`countries`, `plans`) are never filtered by accident.
- Reuses `@tenantry/core`'s `RlsSessionService` — RLS logic lives in exactly one place across adapters.
- Testcontainers integration suite covering all three strategies plus the deliberate-bug scenario, and a **cross-adapter parity suite** asserting Prisma and TypeORM produce identical isolation outcomes.
