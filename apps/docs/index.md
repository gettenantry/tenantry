---
layout: home

hero:
  name: Tenantry
  text: Multi-tenancy toolkit for NestJS
  tagline: Tenant context, PostgreSQL Row-Level Security, and thin ORM adapters — isolation you can prove, not just hope for.
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Why Tenantry?
      link: /comparison
    - theme: alt
      text: View on GitHub
      link: https://github.com/gettenantry/tenantry

features:
  - title: Defense in depth
    details: Application-level tenant filtering combined with PostgreSQL Row-Level Security — a bug in your code no longer means a data leak.
  - title: ORM-agnostic core
    details: Tenant context via AsyncLocalStorage, guards, and decorators live in @tenantry/core. Adapters stay thin — Prisma and TypeORM, same guarantees, proven by a cross-adapter parity suite.
  - title: Proven isolation
    details: Integration tests against a real PostgreSQL (Testcontainers) prove tenant A can never read tenant B's rows — even with a deliberately introduced bug.
---
