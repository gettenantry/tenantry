# @tenantry/typeorm

## 0.1.0

### Minor Changes

- [`fd91e6b`](https://github.com/gettenantry/tenantry/commit/fd91e6b4029230c5982b14fa3f71639bb49d73a9) Thanks [@devanonyme42](https://github.com/devanonyme42)! - Initial release of the TypeORM adapter.

  - **`TenantSubscriber`** — enforces the tenant boundary on writes: stamps the tenant column on insert (overriding smuggled values), and refuses cross-tenant updates/removes and tenant-column rebinding (`CrossTenantOperationError`).
  - **`TenantBaseRepository`** — a real `Repository<T>` whose reads (`find*`, `count*`, `exists*`) and criteria writes (`update`, `delete`) are scoped to the current tenant.
  - **Three isolation strategies**: `hybrid` (tenant filter + RLS, default), `rls-only`, and **`schema-per-tenant`** (dynamic `search_path` per operation) — the last of which no other NestJS multi-tenancy library offers alongside RLS.
  - **Entity classification** via `@TenantAware()` / `@GlobalEntity()`, or `entities: 'all' | 'decorated' | [...]`. `@GlobalEntity()` always wins, so shared tables (`countries`, `plans`) are never filtered by accident.
  - Reuses `@tenantry/core`'s `RlsSessionService` — RLS logic lives in exactly one place across adapters.
  - Testcontainers integration suite covering all three strategies plus the deliberate-bug scenario, and a **cross-adapter parity suite** asserting Prisma and TypeORM produce identical isolation outcomes.

### Patch Changes

- Updated dependencies [[`d7a553b`](https://github.com/gettenantry/tenantry/commit/d7a553b8191d353555d71fb01a95616de6b53c4d)]:
  - @tenantry/core@0.1.0
