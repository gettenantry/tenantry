# Roadmap

## v1.0 — Prisma + TypeORM 🚧 _code complete, release imminent_

The goal: the multi-tenancy solution for NestJS that currently does not exist — Prisma **and** TypeORM, both with first-class PostgreSQL RLS.

- [x] `@tenantry/core`
  - [x] `TenantContextService` — AsyncLocalStorage-based tenant context (`run`, `getTenantId`, `setTenantId`)
  - [x] `TenancyModule.forRoot()` — extraction strategies: header, JWT claim, subdomain, custom callback
  - [x] `@CurrentTenant()` parameter decorator
  - [x] `TenancyGuard` + `@Public()` bypass
  - [x] `RlsSessionService` — PostgreSQL session variable management, ORM-agnostic
- [x] `@tenantry/prisma`
  - [x] Prisma Client extension: automatic tenant filtering on tenant-aware models
  - [x] RLS session binding per transaction (`set_config('app.current_tenant', …, true)`)
  - [x] Isolation modes: **hybrid** (app filter + RLS) and **rls-only**
  - [x] Testcontainers integration tests proving isolation (including with a deliberately introduced app bug)
- [x] `@tenantry/typeorm`
  - [x] `TenantSubscriber` — tenant stamping + cross-tenant write refusal on insert/update/remove
  - [x] `TenantBaseRepository` — automatic read + criteria-write filtering
  - [x] Isolation strategies: row-level (tenant column), **schema-per-tenant** (dynamic `search_path`), RLS-only
  - [x] Explicit `@GlobalEntity()` opt-out for shared tables (`countries`, `plans`, …)
  - [x] Testcontainers integration tests (all three strategies, same guarantees as Prisma)
- [x] `apps/example-prisma` — runnable demo (REST API, docker-compose PostgreSQL)
- [x] `apps/example-typeorm` — mirror of `example-prisma` (same routes, same use cases)
- [x] Cross-adapter isolation regression test (one scenario, both adapters)
- [x] Documentation site on GitHub Pages
- [ ] Published to npm with provenance

## v2.0+ — community-driven 💬 _not scheduled_

Evaluated based on real user demand once v1 has traction — not built in anticipation:

- Sequelize adapter
- Hierarchical tenancy (organization → tenant)
- Cross-tenant shared entities
- Joining user-managed transactions (Prisma & TypeORM)

Have an opinion? The [open discussion issue](https://github.com/gettenantry/tenantry/issues/16) collects votes.
