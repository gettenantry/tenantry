# @tenantry/core

ORM-agnostic multi-tenancy core for [NestJS](https://nestjs.com): tenant context propagation via `AsyncLocalStorage`, pluggable tenant extraction strategies (header, JWT claim, subdomain, custom), request guard with explicit `@Public()` opt-out, and PostgreSQL Row-Level Security session management shared by every ORM adapter.

> **Status: pre-release.** Part of [Tenantry](https://github.com/gettenantry/tenantry) — multi-tenancy for NestJS that you can prove, not just hope for.

## Installation

```sh
pnpm add @tenantry/core
```

Pair it with an ORM adapter:

- [`@tenantry/prisma`](https://github.com/gettenantry/tenantry/tree/main/packages/prisma) — Prisma Client extension with automatic tenant filtering and RLS support

## Usage

```ts
TenancyModule.forRoot({
  extraction: { strategy: 'header', header: 'x-tenant-id' },
}),
{ provide: APP_GUARD, useClass: TenancyGuard },
```

## Documentation

- [Quickstart](https://gettenantry.github.io/tenantry/guide/quickstart)
- [Tenant context](https://gettenantry.github.io/tenantry/guide/concepts/tenant-context)
- [Tenant extraction](https://gettenantry.github.io/tenantry/guide/concepts/extraction)
- [API reference](https://gettenantry.github.io/tenantry/reference/core)

## License

[MIT](https://github.com/gettenantry/tenantry/blob/main/LICENSE)
