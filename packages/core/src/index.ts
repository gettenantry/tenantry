/**
 * @tenantry/core — ORM-agnostic multi-tenancy core for NestJS.
 */

export {
  MissingTenantError,
  TenancyError,
  TenantContextError,
  UnsafeSqlValueError,
} from './errors';

export { TenantContextService } from './context/tenant-context.service';
export { getCurrentTenantId, hasActiveContext, runWithTenant } from './context/tenant-storage';

export { CurrentTenant, currentTenantFactory } from './decorators/current-tenant.decorator';
export { IS_PUBLIC_ROUTE, Public } from './decorators/public.decorator';

export { TenancyGuard } from './guards/tenancy.guard';

export {
  createTenantExtractor,
  headerExtractor,
  jwtClaimExtractor,
  subdomainExtractor,
} from './extraction/extractors';

export { TenancyMiddleware } from './middleware/tenancy.middleware';
export { TenancyModule } from './tenancy.module';
export { TENANCY_MODULE_OPTIONS, TENANT_EXTRACTOR } from './tokens';

export {
  RlsSessionService,
  type RlsQueryExecutor,
  type RlsSessionOptions,
  type SqlStatement,
} from './rls/rls-session.service';

export type {
  CustomExtractionOptions,
  ExtractionOptions,
  HeaderExtractionOptions,
  JwtClaimExtractionOptions,
  RequestLike,
  SubdomainExtractionOptions,
  TenancyGuardOptions,
  TenancyModuleOptions,
  TenantExtractor,
} from './types';
