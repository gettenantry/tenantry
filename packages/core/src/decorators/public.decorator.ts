import { SetMetadata, type CustomDecorator } from '@nestjs/common';

/** Metadata key checked by `TenancyGuard`. */
export const IS_PUBLIC_ROUTE = 'tenantry:is_public_route';

/**
 * Marks a route (or a whole controller) as public: `TenancyGuard` lets the
 * request through even when no tenant is resolved.
 *
 * Multi-tenancy must be opt-out per route, never accidentally absent — this
 * decorator is the single, explicit opt-out.
 */
export function Public(): CustomDecorator {
  return SetMetadata(IS_PUBLIC_ROUTE, true);
}
