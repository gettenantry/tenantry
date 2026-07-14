/**
 * @tenantry/prisma — Prisma adapter for Tenantry.
 */

export { applyTenantToArgs, UnsupportedOperationError } from './args-transform';
export { createTenancyExtension } from './extension';
export {
  resolveOptions,
  type IsolationMode,
  type MissingTenantBehavior,
  type ResolvedTenantryPrismaOptions,
  type TenantryPrismaOptions,
} from './options';
