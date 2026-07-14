# @tenantry/core

ORM-agnostic multi-tenancy core for NestJS: tenant context propagation via `AsyncLocalStorage`, pluggable tenant extraction strategies (header, JWT claim, subdomain, custom), request guards, and PostgreSQL Row-Level Security session management.

> **Status: pre-release.** The public API is being built — see the [roadmap](../../ROADMAP.md).

Pair it with an ORM adapter:

- [`@tenantry/prisma`](../prisma) — Prisma Client extension with automatic tenant filtering and RLS support

## Installation

```sh
pnpm add @tenantry/core
```

## Documentation

Full documentation lives at the [Tenantry docs site](https://github.com/gettenantry/tenantry) (GitHub Pages link coming with v1).

## License

[MIT](../../LICENSE)
