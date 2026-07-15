<div align="center">

# Tenantry

**Multi-tenancy for NestJS that you can prove, not just hope for.**

[![CI](https://github.com/gettenantry/tenantry/actions/workflows/ci.yml/badge.svg)](https://github.com/gettenantry/tenantry/actions/workflows/ci.yml)
[![CodeQL](https://github.com/gettenantry/tenantry/actions/workflows/codeql.yml/badge.svg)](https://github.com/gettenantry/tenantry/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e.svg)](LICENSE)

<!-- Enable at first npm release (see .github/GOING_PUBLIC_CHECKLIST.md):
[![npm](https://img.shields.io/npm/v/@tenantry/core)](https://www.npmjs.com/package/@tenantry/core)
[![npm downloads](https://img.shields.io/npm/dm/@tenantry/core)](https://www.npmjs.com/package/@tenantry/core)
[![codecov](https://codecov.io/gh/gettenantry/tenantry/branch/main/graph/badge.svg)](https://codecov.io/gh/gettenantry/tenantry)
-->

[Documentation](https://gettenantry.github.io/tenantry/) ·
[Quickstart](https://gettenantry.github.io/tenantry/guide/quickstart) ·
[Why Tenantry?](https://gettenantry.github.io/tenantry/comparison) ·
[Roadmap](ROADMAP.md)

</div>

---

A forgotten `WHERE tenant_id = ?` should be a non-event, not a data breach. Tenantry gives your NestJS application **tenant isolation with defense in depth**: automatic query scoping through thin ORM adapters, backed by **PostgreSQL Row-Level Security** — and an [integration suite](packages/prisma/test/integration/isolation.spec.ts) that proves a deliberately buggy, unfiltered raw query _still_ cannot read another tenant's rows.

> **Status: pre-release.** The v1 code is complete, 100%-covered and CI-proven; the first npm release is imminent. APIs may still move until then — follow the [roadmap](ROADMAP.md).

## Packages

| Package                                 | Description                                                                                                                                                | Status                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [`@tenantry/core`](packages/core)       | ORM-agnostic core: tenant context (`AsyncLocalStorage`), extraction strategies (header, JWT, subdomain, custom), guard, decorators, RLS session management | 🚧 v1 — 100% test coverage |
| [`@tenantry/prisma`](packages/prisma)   | Prisma Client extension: automatic tenant filtering + hybrid/RLS-only isolation modes                                                                      | 🚧 v1 — 100% test coverage |
| [`@tenantry/typeorm`](packages/typeorm) | TypeORM adapter: subscriber + repository filtering, hybrid/RLS-only/**schema-per-tenant**                                                                  | 🚧 v1 — 100% test coverage |

## Sixty seconds to isolated tenants

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

Add the RLS policy (one `CREATE POLICY`, [guided](https://gettenantry.github.io/tenantry/guide/quickstart)) and even raw SQL can't cross tenant lines. Full walkthrough: **[Quickstart](https://gettenantry.github.io/tenantry/guide/quickstart)**.

## Why Tenantry?

- **No quality multi-tenancy solution exists for Prisma + NestJS** — teams re-implement (and mis-implement) tenant filtering by hand.
- **RLS as a first-class citizen**: most libraries stop at `WHERE tenant_id = ?`. Tenantry manages the PostgreSQL session binding and policy DDL, so isolation holds even when application code is buggy.
- **Proven, not promised**: [the flagship integration test](packages/prisma/test/integration/isolation.spec.ts) runs both isolation modes against a real PostgreSQL (Testcontainers) on every CI build — including a deliberately introduced bug (an unfiltered raw query) and a completely unprotected client. Neither can leak a row.
- **Fail closed by design**: missing tenant → throw; unknown operation → throw; unbound session variable → empty table. Loud failures beat silent leaks.
- **ORM-agnostic core**: adapters stay thin and share the same `RlsSessionService` — same guarantees whatever the ORM.

Honest comparison with `nestjs-mtenant` and hand-rolled approaches — including when Tenantry is _not_ the right choice: **[vs. alternatives](https://gettenantry.github.io/tenantry/comparison)**.

## Documentation

**[gettenantry.github.io/tenantry](https://gettenantry.github.io/tenantry/)** — highlights:

- [Isolation & RLS](https://gettenantry.github.io/tenantry/guide/concepts/isolation) — hybrid vs RLS-only, and exactly what protects you when code goes wrong
- [Tenant extraction](https://gettenantry.github.io/tenantry/guide/concepts/extraction) — header, JWT claim, subdomain, custom (and their security caveats)
- [Prisma guide](https://gettenantry.github.io/tenantry/guide/prisma) — per-operation behavior, options, known limitations
- [API reference](https://gettenantry.github.io/tenantry/reference/core) · [FAQ](https://gettenantry.github.io/tenantry/faq)

Design rationale and diagrams: [ARCHITECTURE.md](ARCHITECTURE.md).

## Try it locally

A runnable demo API — docker-compose PostgreSQL, RLS migration, non-superuser app role, curl-able isolation:

```sh
git clone https://github.com/gettenantry/tenantry && cd tenantry
pnpm install && pnpm build
docker compose -f apps/example-prisma/docker-compose.yml up -d --wait
```

Then follow [`apps/example-prisma`](apps/example-prisma).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing (unit + Testcontainers), commit conventions and the changeset flow. Good entry points carry the [`good first issue`](https://github.com/gettenantry/tenantry/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label.

**Security issues**: never a public issue — see [SECURITY.md](SECURITY.md) for private reporting.

## Sponsors

_This section is reserved — sponsoring opens with the first stable release._

## License

[MIT](LICENSE) © devanonyme42 and Tenantry contributors
