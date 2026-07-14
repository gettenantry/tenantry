/**
 * Minimal, framework-agnostic view of an incoming request. Compatible with
 * Express and Fastify request objects without depending on either.
 */
export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  /** Populated by Express (`req.hostname`) and Fastify (`req.hostname`). */
  hostname?: string;
}

/**
 * Resolves the tenant for a request. Returning `null`/`undefined` opens an
 * empty tenant context — `TenancyGuard` then decides whether to reject.
 */
export type TenantExtractor = (
  request: RequestLike,
) => string | null | undefined | Promise<string | null | undefined>;

/** Extract the tenant from a request header (default: `x-tenant-id`). */
export interface HeaderExtractionOptions {
  strategy: 'header';
  /** Header name, case-insensitive. @default 'x-tenant-id' */
  header?: string;
}

/**
 * Extract the tenant from a claim of the JWT carried by the
 * `Authorization: Bearer …` header.
 *
 * **The token signature is NOT verified** — that is the job of your
 * authentication layer, which must run before any trust is placed in the
 * claim. This strategy only decodes the payload.
 */
export interface JwtClaimExtractionOptions {
  strategy: 'jwt';
  /** Claim holding the tenant id. @default 'tenantId' */
  claim?: string;
  /** Header carrying the bearer token. @default 'authorization' */
  header?: string;
}

/**
 * Extract the tenant from the left-most subdomain relative to a base domain:
 * with `baseDomain: 'example.com'`, `acme.example.com` resolves to `acme`.
 * Hosts that do not end with the base domain — or with more than one label
 * in front of it — resolve to no tenant.
 */
export interface SubdomainExtractionOptions {
  strategy: 'subdomain';
  /** Base domain the tenant subdomain is prepended to (no leading dot). */
  baseDomain: string;
}

/** Bring your own extraction logic. */
export interface CustomExtractionOptions {
  strategy: 'custom';
  extractor: TenantExtractor;
}

export type ExtractionOptions =
  | HeaderExtractionOptions
  | JwtClaimExtractionOptions
  | SubdomainExtractionOptions
  | CustomExtractionOptions;

export interface TenancyGuardOptions {
  /** Builds the exception thrown for tenant-less requests. @default 403 ForbiddenException */
  exceptionFactory?: () => Error;
}

export interface TenancyModuleOptions {
  /** How the tenant is extracted from incoming requests. */
  extraction: ExtractionOptions;
  guard?: TenancyGuardOptions;
  /**
   * Route patterns the tenancy middleware is applied to.
   *
   * The default targets every route using the NestJS 11 / path-to-regexp v8
   * wildcard syntax. On NestJS 10, pass `['*']` instead.
   *
   * @default ['{*splat}']
   */
  middlewareRoutes?: string[];
}
