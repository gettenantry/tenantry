# TypeORM adapter <Badge type="warning" text="planned — v2" />

`@tenantry/typeorm` is the second adapter on the [roadmap](https://github.com/gettenantry/tenantry/blob/main/ROADMAP.md), starting **after** v1 (Prisma) is published and stable.

## What's planned

Same guarantees as the Prisma adapter, same core, plus TypeORM-specific strategies:

- **`TenantSubscriber`** — stamps `tenantId` on `insert`/`update` for tenant-aware entities.
- **`TenantBaseRepository<T>`** — applies the tenant filter to every read path.
- **Three isolation strategies**: row-level (`tenant_id` + filter), **schema-per-tenant** (dynamic `search_path` per connection), and RLS-only — reusing the exact same `RlsSessionService` from `@tenantry/core`.
- **Explicit global entities** — opt-out for shared tables (`countries`, `plans`), so nothing is filtered by accident.
- **Cross-adapter regression test** — the same isolation scenario runs against Prisma _and_ TypeORM, guaranteeing identical security behavior.

## Why after v1?

Focus. Shipping one adapter with 100%-covered security code, real integration proofs and polished docs beats shipping two half-done ones. The core API you learn today (`TenantContextService`, `@CurrentTenant`, `TenancyGuard`, extraction strategies) is adapter-agnostic and will not change when TypeORM lands.

Track progress or vote on priorities in the [v2 milestone](https://github.com/gettenantry/tenantry/milestone/2).
