# Contributing to Tenantry

Thanks for your interest in contributing! This guide gets you from clone to merged PR.

## Local setup

Requirements: **Node >= 22**, **pnpm >= 11** (`npm i -g pnpm`), **Docker** (for integration tests only).

```sh
git clone https://github.com/gettenantry/tenantry
cd tenantry
pnpm install
pnpm build
```

## Everyday commands

| Command                 | What it does                                                                     |
| ----------------------- | -------------------------------------------------------------------------------- |
| `pnpm build`            | Build all packages (Turborepo, cached)                                           |
| `pnpm lint`             | ESLint (type-checked rules, no `any`)                                            |
| `pnpm typecheck`        | `tsc --noEmit` on every package                                                  |
| `pnpm test`             | Unit tests with coverage (Vitest)                                                |
| `pnpm test:integration` | Integration tests against a real PostgreSQL via Testcontainers — requires Docker |
| `pnpm format`           | Prettier on the whole repo                                                       |

To scope to one package: `pnpm --filter @tenantry/core test`.

## Commit convention

We enforce [Conventional Commits](https://www.conventionalcommits.org) via commitlint (a non-conforming commit is rejected by the `commit-msg` hook):

```
feat(core): add subdomain extraction strategy
fix(prisma): apply tenant filter on upsert operations
docs: clarify RLS-only mode caveats
test(core): cover TenancyGuard public route bypass
chore: bump turbo to 2.5
```

## Proposing a change

1. Fork / branch from `main` (`feat/...`, `fix/...`).
2. Write tests **with** the change — security-critical code (context, guards, adapters) targets 100% coverage; the CI gate is 90% minimum.
3. Add a changeset if the change affects a published package: `pnpm changeset` (pick the bump level, write a user-facing summary).
4. Open a PR — the template checklist asks for tests, docs, and changeset.
5. CI must be green (lint, typecheck, unit + integration tests, build) and one review is required before merge.

## Questions

Open an issue with the _question_ template. For security reports, follow [SECURITY.md](SECURITY.md) — never a public issue.
