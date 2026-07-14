# Security Policy

Tenantry is a **data-isolation library**: a vulnerability here can mean cross-tenant data exposure in every application that uses it. We take reports extremely seriously.

## Reporting a vulnerability

**Please do NOT open a public issue for security problems.**

Preferred channel: **GitHub private vulnerability reporting** — [Security → Report a vulnerability](https://github.com/gettenantry/tenantry/security/advisories/new) on this repository.

Alternatively, email **devanonyme42izahbabm@gmail.com** with `[SECURITY][tenantry]` in the subject.

Please include:

- Affected package and version (`@tenantry/core`, `@tenantry/prisma`, …)
- A minimal reproduction (schema + code) demonstrating the isolation breach
- The isolation mode in use (hybrid, RLS-only, application-only)

## What to expect

- **Acknowledgement within 72 hours.**
- We assess severity, develop a fix privately, and coordinate a release with a GitHub Security Advisory and CVE where applicable.
- Credit is given to reporters in the advisory unless you prefer to stay anonymous.

## Supported versions

Until v1.0.0 is released, only the latest published version of each package receives security fixes.
