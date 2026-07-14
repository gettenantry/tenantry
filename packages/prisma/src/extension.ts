import { Prisma } from '@prisma/client/extension';
import type {
  JsArgs,
  ModelQueryOptionsCbArgs,
  QueryOptionsCbArgs,
} from '@prisma/client/runtime/library';
import { MissingTenantError, RlsSessionService } from '@tenantry/core';

import { applyTenantToArgs } from './args-transform';
import { resolveOptions, type TenantryPrismaOptions } from './options';

/**
 * Structural view of the Prisma client methods the extension relies on —
 * keeps this package decoupled from any generated client.
 */
interface RlsCapableClient {
  $executeRawUnsafe(sql: string, ...parameters: unknown[]): Promise<unknown>;
  $transaction(operations: Promise<unknown>[]): Promise<unknown[]>;
}

/**
 * Creates the Tenantry Prisma extension.
 *
 * For every operation on a tenant-aware model, the extension:
 *
 * 1. resolves the current tenant (from the AsyncLocalStorage context by
 *    default) — and fails closed when there is none;
 * 2. in `hybrid` mode, injects the tenant filter into the operation's
 *    arguments (`where` for reads, `data` for creates);
 * 3. binds the RLS session variable and runs the operation **inside the same
 *    transaction** (`SELECT set_config(var, tenant, true)` + query), so the
 *    binding always lands on the same pooled connection as the query and
 *    resets when the transaction ends.
 *
 * Raw queries (`$queryRaw`, `$executeRaw` and their unsafe variants) cannot
 * be filtered at the application level, so they get the RLS binding — the
 * PostgreSQL policy remains in charge, which is exactly what the
 * deliberate-bug integration test proves.
 *
 * Known v1 limitation: operations issued inside a user-managed interactive
 * transaction get their own RLS-binding transaction instead of joining the
 * outer one.
 *
 * @example
 * ```ts
 * const prisma = new PrismaClient().$extends(
 *   createTenancyExtension({ models: ['Project'] }),
 * );
 * ```
 */
// The return type stays inferred from Prisma.defineExtension so that
// client.$extends() keeps full type information on the consumer side.
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createTenancyExtension(options: TenantryPrismaOptions) {
  const resolved = resolveOptions(options);
  const rls =
    resolved.sessionVariable === false
      ? undefined
      : new RlsSessionService({ variable: resolved.sessionVariable });

  return Prisma.defineExtension((client) => {
    const rawClient = client as unknown as RlsCapableClient;

    function runWithRlsBinding<A>(
      tenantId: string,
      query: (args: A) => Promise<unknown>,
      args: A,
    ): Promise<unknown> {
      if (rls === undefined) {
        return query(args);
      }
      const statement = rls.buildSetTenantStatement(tenantId);
      return rawClient
        .$transaction([
          rawClient.$executeRawUnsafe(statement.sql, ...statement.parameters),
          query(args),
        ])
        .then((results) => results[1]);
    }

    function handleModelOperation({
      model,
      operation,
      args,
      query,
    }: ModelQueryOptionsCbArgs): Promise<unknown> {
      const tenantId = resolved.getTenantId();
      const isTenantAware = resolved.models === 'all' || resolved.models.has(model);

      if (!isTenantAware) {
        return query(args);
      }

      if (tenantId === undefined) {
        if (resolved.onMissingTenant === 'passthrough') {
          return query(args);
        }
        throw new MissingTenantError(
          `Operation "${operation}" on tenant-aware model "${model}" was ` +
            'attempted without a tenant in context. Wrap the unit of work in ' +
            "TenantContextService.run(), or mark the model as global if it isn't tenant-scoped.",
        );
      }

      const scopedArgs =
        resolved.isolation === 'hybrid'
          ? (applyTenantToArgs(operation, args, resolved.tenantField, tenantId) as JsArgs)
          : args;

      return runWithRlsBinding(tenantId, query, scopedArgs);
    }

    function handleRawOperation({ args, query }: QueryOptionsCbArgs): Promise<unknown> {
      const tenantId = resolved.getTenantId();
      if (tenantId === undefined) {
        // No tenant: run unbound. On RLS-protected tables the policy then
        // evaluates to NULL → no rows. Fails closed at the database.
        return query(args);
      }
      return runWithRlsBinding(tenantId, query, args);
    }

    return client.$extends({
      name: 'tenantry',
      query: {
        $allModels: {
          $allOperations: handleModelOperation,
        },
        $queryRaw: handleRawOperation,
        $queryRawUnsafe: handleRawOperation,
        $executeRaw: handleRawOperation,
        $executeRawUnsafe: handleRawOperation,
      },
    });
  });
}
