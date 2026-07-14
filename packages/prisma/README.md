# @tenantry/prisma

Prisma adapter for [Tenantry](https://github.com/gettenantry/tenantry): a client extension (`$extends`) that automatically scopes every operation on tenant-aware models — with two PostgreSQL isolation modes, **hybrid** (application filter + Row-Level Security as defense in depth) and **RLS-only**.

Isolation is [proven by integration tests](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts) against a real PostgreSQL, including a deliberately unfiltered raw query that still cannot read another tenant's rows.

> **Status: pre-release.**

## Installation

```sh
pnpm add @tenantry/core @tenantry/prisma
```

## Usage

```ts
import { PrismaClient } from '@prisma/client';
import { createTenancyExtension } from '@tenantry/prisma';

const prisma = new PrismaClient().$extends(
  createTenancyExtension({
    models: ['Project'], // tenant-aware models
    isolation: 'hybrid', // or 'rls-only'
  }),
);

// Every Project query is now scoped to the current tenant.
prisma.project.findMany();
```

## Documentation

- [Quickstart](https://gettenantry.github.io/tenantry/guide/quickstart)
- [Prisma guide](https://gettenantry.github.io/tenantry/guide/prisma) — per-operation behavior, options, limitations
- [Isolation & RLS](https://gettenantry.github.io/tenantry/guide/concepts/isolation)
- [API reference](https://gettenantry.github.io/tenantry/reference/prisma)

## License

[MIT](https://github.com/gettenantry/tenantry/blob/main/LICENSE)
