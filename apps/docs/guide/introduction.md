# Introduction

Tenantry is a multi-tenancy toolkit for [NestJS](https://nestjs.com). It gives you:

- **Tenant context propagation** with `AsyncLocalStorage` — no request-scoped provider overhead.
- **Pluggable tenant extraction** — header, JWT claim, subdomain, or your own strategy.
- **PostgreSQL Row-Level Security** management, reusable by any ORM adapter.
- **Thin ORM adapters** — Prisma first (`@tenantry/prisma`), TypeORM next.

> **Status: pre-release.** v1 (Prisma MVP) is under active development — follow the [roadmap](https://github.com/gettenantry/tenantry/blob/main/ROADMAP.md).

This documentation will grow alongside v1: quickstart, concepts (RLS vs application-level filtering), adapter guides, and API reference.
