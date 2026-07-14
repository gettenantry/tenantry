/**
 * @tenantry/core — ORM-agnostic multi-tenancy core for NestJS.
 *
 * Public API surface. Implementation lands in v1 (see ROADMAP.md):
 * - TenantContextService (AsyncLocalStorage-based tenant context)
 * - TenancyModule.forRoot() with pluggable extraction strategies
 * - @CurrentTenant() parameter decorator
 * - TenancyGuard with @Public() bypass
 * - RlsSessionService for PostgreSQL session variables
 */

export const TENANTRY_VERSION = '0.0.0';
