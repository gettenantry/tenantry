# @tenantry/prisma

Prisma adapter for [Tenantry](../../README.md): automatic tenant filtering via Prisma Client extensions (`$extends`), with two PostgreSQL isolation modes — **hybrid** (application-level filter + Row-Level Security as defense in depth) and **RLS-only**.

> **Status: pre-release.** The public API is being built — see the [roadmap](../../ROADMAP.md).

## Installation

```sh
pnpm add @tenantry/core @tenantry/prisma
```

## Documentation

Full documentation lives at the [Tenantry docs site](https://github.com/gettenantry/tenantry) (GitHub Pages link coming with v1).

## License

[MIT](../../LICENSE)
