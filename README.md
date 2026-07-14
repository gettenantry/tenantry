# Tenantry

[![CI](https://github.com/gettenantry/tenantry/actions/workflows/ci.yml/badge.svg)](https://github.com/gettenantry/tenantry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)

<!-- Enable at first npm release (Phase 6 checklist):
[![npm](https://img.shields.io/npm/v/@tenantry/core)](https://www.npmjs.com/package/@tenantry/core)
[![npm downloads](https://img.shields.io/npm/dm/@tenantry/core)](https://www.npmjs.com/package/@tenantry/core)
[![codecov](https://codecov.io/gh/gettenantry/tenantry/branch/main/graph/badge.svg)](https://codecov.io/gh/gettenantry/tenantry)
-->

> Multi-tenancy for NestJS that you can prove, not just hope for.

A forgotten `WHERE tenant_id = ?` should be a non-event, not a data breach. Tenantry gives your NestJS application **tenant isolation with defense in depth**: automatic query scoping through thin ORM adapters, backed by **PostgreSQL Row-Level Security** — and an integration suite that proves a deliberately buggy, unfiltered raw query _still_ cannot read another tenant's rows.

> **Status: pre-release (v1 in development).** APIs may still move before the first npm release. Follow the [roadmap](ROADMAP.md).

## Packages

| Package                               | Description                                                                                                                                                | Status                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [`@tenantry/core`](packages/core)     | ORM-agnostic core: tenant context (`AsyncLocalStorage`), extraction strategies (header, JWT, subdomain, custom), guard, decorators, RLS session management | 🚧 v1 — 100% test coverage |
| [`@tenantry/prisma`](packages/prisma) | Prisma Client extension: automatic tenant filtering + hybrid/RLS-only isolation modes                                                                      | 🚧 v1 — 100% test coverage |
| `@tenantry/typeorm`                   | TypeORM adapter: subscriber + repository filtering, schema-per-tenant, RLS                                                                                 | 📋 v2                      |

## Quickstart

```ts
// app.module.ts — wire the tenant into every request
TenancyModule.forRoot({
  extraction: { strategy: 'header', header: 'x-tenant-id' },
}),
{ provide: APP_GUARD, useClass: TenancyGuard },

// prisma.service.ts — scope every query
const prisma = new PrismaClient().$extends(
  createTenancyExtension({ models: ['Project'] }),
);

// anywhere — tenant-scoped automatically, no tenantId in sight
prisma.project.findMany();
```

Full walkthrough (including the RLS policy and the non-superuser role): **[Quickstart guide](apps/docs/guide/quickstart.md)**.

## Why Tenantry?

- **No quality multi-tenancy solution exists for Prisma + NestJS** — teams re-implement (and mis-implement) tenant filtering by hand.
- **RLS as a first-class citizen**: most libraries stop at `WHERE tenant_id = ?`. Tenantry manages the PostgreSQL session binding and policy DDL, so isolation holds even when application code is buggy.
- **Proven, not promised**: [the flagship integration test](packages/prisma/test/integration/isolation.spec.ts) runs both isolation modes against a real PostgreSQL (Testcontainers), including a deliberately introduced bug — an unfiltered raw query — and a completely unprotected client. Neither can leak a row.
- **Fail closed by design**: missing tenant → throw; unknown operation → throw; unbound session variable → empty table. Loud failures beat silent leaks.
- **ORM-agnostic core**: adapters stay thin and share the same `RlsSessionService` — same guarantees whatever the ORM.

Honest comparison with `nestjs-mtenant` and hand-rolled approaches: [docs/comparison](apps/docs/comparison.md).

## Documentation

The full documentation site (VitePress) lives in [`apps/docs`](apps/docs) and deploys to GitHub Pages with the repository going public. Until then: [Introduction](apps/docs/guide/introduction.md) · [Quickstart](apps/docs/guide/quickstart.md) · [Isolation & RLS](apps/docs/guide/concepts/isolation.md) · [Prisma guide](apps/docs/guide/prisma.md) · [API reference](apps/docs/reference/core.md) · [FAQ](apps/docs/faq.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)

## Example

A runnable demo API with docker-compose, RLS migration and a non-superuser app role: [`apps/example-prisma`](apps/example-prisma).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see [SECURITY.md](SECURITY.md) — please do **not** open public issues for vulnerabilities.

## Sponsors

_This section is reserved — sponsoring opens once the project goes public._

## License

[MIT](LICENSE)
