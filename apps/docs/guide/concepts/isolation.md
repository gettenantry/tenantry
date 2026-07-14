# Isolation & Row-Level Security

## Two layers, one guarantee

Most multi-tenant codebases rely on a single layer: application-level filtering (`WHERE tenant_id = ?`). It's fast and produces friendly errors — but a single forgotten `where`, a raw SQL query, or a clever `OR` condition in user input, and tenant B's data is in tenant A's response.

PostgreSQL **Row-Level Security** moves the boundary into the database: a policy attached to the table decides which rows any query can see or touch. Application bugs stop mattering — the database itself refuses to cross the line.

Tenantry treats RLS as a first-class citizen and offers two modes:

|                                    | `hybrid` (default)                             | `rls-only`                                                 |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Application filter injected        | ✅                                             | ❌                                                         |
| RLS session variable bound         | ✅                                             | ✅                                                         |
| Protects against forgotten filters | ✅ (twice)                                     | ✅                                                         |
| Protects raw SQL queries           | ✅ (via RLS)                                   | ✅                                                         |
| Creates stamped automatically      | ✅                                             | ❌ (your code provides `tenantId`; the policy verifies it) |
| Error UX                           | Friendly (empty results, `MissingTenantError`) | DB errors on write violations                              |
| Works without RLS policies in DB   | ✅ (`sessionVariable: false`, discouraged)     | ❌ (refused at setup)                                      |

## How the session variable works

Policies read the tenant from a PostgreSQL setting:

```sql
CREATE POLICY "tenant_isolation" ON "Project"
  USING ("tenantId" = current_setting('app.current_tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));
```

Before each operation, the adapter binds the variable **in the same transaction as the query**:

```sql
BEGIN;
SELECT set_config('app.current_tenant', $tenant, true); -- true = transaction-local
-- your query runs here, on the same pooled connection
COMMIT;
```

Three details make this safe:

1. `set_config(..., true)` is the parameterizable equivalent of `SET LOCAL` — the tenant id is a bind parameter, never interpolated into SQL.
2. Transaction-local scope means the binding **evaporates at COMMIT/ROLLBACK** — a pooled connection can never carry tenant A's binding into tenant B's request.
3. When no tenant is bound, `current_setting(..., true)` returns `NULL`, the policy evaluates to false, and the table is **empty** for that session. Fail closed, not open.

## The rules RLS imposes on you

- **Never connect the application as a superuser** — superusers bypass RLS unconditionally. Use a dedicated role with plain table grants.
- **Always `FORCE ROW LEVEL SECURITY`** — without it, the table _owner_ bypasses policies too. Tenantry's DDL builders emit both statements.
- Migrations still run as an admin role; only the application connection needs to be restricted.

## Trust, but verify

These claims are backed by [the integration suite](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts), which runs both modes against a real PostgreSQL (Testcontainers) and includes:

- a **deliberate application bug** — a raw `SELECT * FROM "Project"` with no filter — that still cannot return another tenant's rows;
- a **completely unprotected client** (no extension, no session variable) that sees zero rows;
- a **smuggled tenant id** on create, rejected by `WITH CHECK` in `rls-only` mode and overwritten by the extension in `hybrid` mode.
