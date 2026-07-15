# Tenantry vs. alternatives

An honest comparison — every claim links to something you can check. If we got a fact wrong, [open an issue](https://github.com/gettenantry/tenantry/issues).

## The landscape

For multi-tenancy in NestJS you have, broadly: [`nestjs-mtenant`](https://github.com/AlexanderC/nestjs-mtenant) (the one library referenced on [Awesome NestJS](https://github.com/nestjs/awesome-nestjs)), rolling your own, or Tenantry.

|                                                   | Tenantry                                                                                                                                                  | nestjs-mtenant                                                                                | Hand-rolled      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------- |
| ORM support                                       | Prisma · TypeORM                                                                                                                                          | Sequelize, TypeORM                                                                            | whatever you use |
| **Prisma support**                                | ✅                                                                                                                                                        | ❌                                                                                            | DIY              |
| Context mechanism                                 | `AsyncLocalStorage`                                                                                                                                       | request-scoped + decorators                                                                   | varies           |
| **PostgreSQL RLS management**                     | ✅ first-class (session binding + policy DDL)                                                                                                             | ❌                                                                                            | rarely done      |
| Isolation proven by integration tests             | ✅ [real PostgreSQL, incl. deliberate-bug scenario](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts) | not that we found                                                                             | on you           |
| Fails closed (missing tenant, unknown operations) | ✅ by design                                                                                                                                              | partially (depends on setup)                                                                  | on you           |
| Maintenance                                       | early but active; org-owned                                                                                                                               | single maintainer; [last release 2022](https://github.com/AlexanderC/nestjs-mtenant/releases) | on you, forever  |
| License                                           | MIT                                                                                                                                                       | MIT                                                                                           | —                |

_Table checked on 2026-07-14. `nestjs-mtenant` remains a genuinely useful library for Sequelize/TypeORM users — if it fits your stack and risk profile, use it._

## Why not just hand-roll it?

Most teams start there: a `tenantId` column and discipline. The failure modes are well known:

1. **The forgotten `where`** — one service method out of two hundred skips the filter. Nothing crashes; you find out from a customer.
2. **The raw query** — reporting and search code drops to SQL, outside whatever wrapper enforced the filter.
3. **The clever input** — an `OR` in user-controlled filter objects that widens the scope.
4. **The pool leak** — session state set per-connection leaking across requests when done by hand.

Tenantry's answer to each is structural, not disciplinary: AND-merged filters that inputs cannot widen, RLS covering raw SQL, fail-closed defaults, and transaction-scoped session binding. And because the checks live in the database too, they hold even when the application code is wrong — which is the [test we lead with](/guide/concepts/isolation#trust-but-verify).

## When Tenantry is NOT the right choice

- You need **Sequelize** today → `nestjs-mtenant` covers it; Tenantry's Sequelize adapter is a post-v1 candidate, driven by demand.
- You're not on **PostgreSQL** → application-level filtering works anywhere Prisma/TypeORM run, but the RLS and schema-per-tenant layers — much of the value proposition — are PostgreSQL-only.
- You need **hierarchical tenancy** (org → tenant) → a post-v1 candidate, [vote here](https://github.com/gettenantry/tenantry/issues/16).

(Need schema-per-tenant? The [TypeORM adapter](/guide/typeorm) ships it today.)
