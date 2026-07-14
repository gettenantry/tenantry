import { Injectable } from '@nestjs/common';

import { MissingTenantError, TenantContextError } from '../errors';
import {
  getCurrentTenantId,
  hasActiveContext,
  runWithTenant,
  setCurrentTenantId,
} from './tenant-storage';

/**
 * Holds the current tenant for the duration of a unit of work (an HTTP
 * request, a queue job, a cron tick…) using `AsyncLocalStorage`.
 *
 * The context is established with {@link run} — typically by
 * `TenancyMiddleware` for HTTP — and is then visible anywhere down the async
 * call chain, without request-scoped providers.
 */
@Injectable()
export class TenantContextService {
  /**
   * Runs `fn` inside a context bound to `tenantId`.
   *
   * Contexts nest: the innermost `run` wins, and the outer tenant is
   * restored when `fn` completes. Passing `undefined` opens an "empty"
   * context (a tenant-less request that guards may then reject).
   */
  run<T>(tenantId: string | undefined, fn: () => T): T {
    return runWithTenant(tenantId, fn);
  }

  /** The current tenant id, or `undefined` when none is bound. Never throws. */
  getTenantId(): string | undefined {
    return getCurrentTenantId();
  }

  /**
   * The current tenant id. Throws {@link MissingTenantError} when none is
   * bound — use this in code paths that must never run tenant-less.
   */
  requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (tenantId === undefined) {
      throw new MissingTenantError();
    }
    return tenantId;
  }

  /**
   * Rebinds the tenant of the active context (e.g. after a late lookup).
   * Throws {@link TenantContextError} outside of a {@link run} context: a
   * tenant set with no context would silently apply to nothing.
   */
  setTenantId(tenantId: string | undefined): void {
    if (!setCurrentTenantId(tenantId)) {
      throw new TenantContextError(
        'setTenantId() was called outside of a tenant context. ' +
          'Wrap the unit of work in TenantContextService.run() first.',
      );
    }
  }

  /** `true` when an execution context is active (even with no tenant bound). */
  isActive(): boolean {
    return hasActiveContext();
  }
}
