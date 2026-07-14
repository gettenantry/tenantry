import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { getCurrentTenantId } from '../context/tenant-storage';

/**
 * Factory behind {@link CurrentTenant}, exported for unit testing.
 *
 * Reads from the AsyncLocalStorage context rather than the request object,
 * so it works identically for HTTP, GraphQL, RPC or any transport — as long
 * as the unit of work was wrapped in `TenantContextService.run()`.
 */
export function currentTenantFactory(
  _data: unknown,
  _context: ExecutionContext,
): string | undefined {
  return getCurrentTenantId();
}

/**
 * Parameter decorator injecting the current tenant id into a handler.
 *
 * Returns `undefined` when no tenant is resolved; pair it with
 * `TenancyGuard` so tenant-less requests are rejected before the handler
 * runs.
 *
 * @example
 * ```ts
 * @Get()
 * findAll(@CurrentTenant() tenantId: string) { ... }
 * ```
 */
export const CurrentTenant = createParamDecorator(currentTenantFactory);
