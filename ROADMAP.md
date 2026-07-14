# Roadmap

## v1.0 — Prisma MVP 🚧 _in progress_

The goal: the multi-tenancy solution for Prisma + NestJS that currently does not exist.

- [ ] `@tenantry/core`
  - [ ] `TenantContextService` — AsyncLocalStorage-based tenant context (`run`, `getTenantId`, `setTenantId`)
  - [ ] `TenancyModule.forRoot()` — extraction strategies: header, JWT claim, subdomain, custom callback
  - [ ] `@CurrentTenant()` parameter decorator
  - [ ] `TenancyGuard` + `@Public()` bypass
  - [ ] `RlsSessionService` — PostgreSQL session variable management, ORM-agnostic
- [ ] `@tenantry/prisma`
  - [ ] Prisma Client extension: automatic tenant filtering on tenant-aware models
  - [ ] RLS session binding per transaction (`SET LOCAL app.current_tenant`)
  - [ ] Isolation modes: **hybrid** (app filter + RLS) and **rls-only**
  - [ ] Testcontainers integration tests proving isolation (including with a deliberately introduced app bug)
- [ ] `apps/example-prisma` — runnable demo (REST API, docker-compose PostgreSQL)
- [ ] Documentation site on GitHub Pages
- [ ] Published to npm with provenance

## v2.0 — TypeORM adapter 📋 _planned — blocked by v1_

Same rigor as v1, targeting feature parity with `nestjs-mtenant` plus RLS (which no TypeORM solution offers today).

- [ ] `@tenantry/typeorm`
  - [ ] `TenantSubscriber` — automatic tenant injection on insert/update
  - [ ] `TenantBaseRepository` — automatic read filtering
  - [ ] Isolation strategies: row-level (tenant_id), schema-per-tenant (dynamic `search_path`), RLS-only
  - [ ] Explicit "global entity" opt-out for shared tables (`countries`, `plans`, …)
  - [ ] Testcontainers integration tests (same guarantees as Prisma)
- [ ] `apps/example-typeorm` — mirror of `example-prisma` (same routes, same use cases)
- [ ] Cross-adapter isolation regression test (one scenario, both adapters)
- [ ] Side-by-side adapter comparison in the docs

## v3+ — community-driven 💬 _not scheduled_

Evaluated based on real user demand once v1/v2 have traction — not built in anticipation:

- Sequelize adapter
- Hierarchical tenancy (organization → tenant)
- Cross-tenant shared entities

Have an opinion? An open discussion issue will collect votes once the repository goes public.
