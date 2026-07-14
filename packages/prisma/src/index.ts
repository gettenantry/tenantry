/**
 * @tenantry/prisma — Prisma adapter for Tenantry.
 *
 * Public API surface. Implementation lands in v1 (see ROADMAP.md):
 * - Prisma Client extension injecting tenant filters on tenant-aware models
 * - RLS session middleware (SET app.current_tenant per transaction)
 * - "hybrid" (app filter + RLS) and "rls-only" isolation modes
 */

export const TENANTRY_PRISMA_VERSION = '0.0.0';
