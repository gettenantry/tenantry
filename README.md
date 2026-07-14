# Tenantry

> Multi-tenancy for NestJS that you can prove, not just hope for.

Tenantry gives your NestJS application **tenant isolation with defense in depth**: application-level filtering through thin ORM adapters, backed by **PostgreSQL Row-Level Security** — so a bug in your code no longer means a cross-tenant data leak.

> **Status: pre-release (v1 in development).** APIs are not stable yet. Follow the [roadmap](ROADMAP.md).

## Packages

| Package                               | Description                                                                                                                                                 | Status |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [`@tenantry/core`](packages/core)     | ORM-agnostic core: tenant context (`AsyncLocalStorage`), extraction strategies (header, JWT, subdomain, custom), guards, decorators, RLS session management | 🚧 v1  |
| [`@tenantry/prisma`](packages/prisma) | Prisma Client extension: automatic tenant filtering + hybrid/RLS-only isolation modes                                                                       | 🚧 v1  |
| `@tenantry/typeorm`                   | TypeORM adapter: subscriber + repository filtering, schema-per-tenant, RLS                                                                                  | 📋 v2  |

## Why Tenantry?

- **No quality multi-tenancy solution exists for Prisma + NestJS** — teams re-implement (and mis-implement) tenant filtering by hand.
- **RLS as a first-class citizen**: most libraries stop at `WHERE tenant_id = ?`. Tenantry manages PostgreSQL Row-Level Security policies so isolation holds even when application code is buggy.
- **Proven isolation**: our integration tests run against a real PostgreSQL (Testcontainers) and demonstrate that tenant A can never read tenant B's rows — _including with a deliberately introduced application bug_.
- **ORM-agnostic architecture**: the core never depends on an ORM; adapters stay thin and consistent.

## Quickstart

Coming with v1 — the target API:

```ts
// app.module.ts
TenancyModule.forRoot({
  extraction: { strategy: 'header', header: 'x-tenant-id' },
});

// anywhere in a request
@Get()
findAll(@CurrentTenant() tenantId: string) {
  return this.projects.findAll(); // automatically scoped to the current tenant
}
```

## Documentation

Full documentation (GitHub Pages) ships with v1. Meanwhile, see [ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see [SECURITY.md](SECURITY.md) — please do **not** open public issues for vulnerabilities.

## Sponsors

_This section is reserved — sponsoring opens once the project goes public._

## License

[MIT](LICENSE)
