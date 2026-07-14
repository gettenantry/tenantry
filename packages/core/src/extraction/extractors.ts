import { type ExtractionOptions, type RequestLike, type TenantExtractor } from '../types';

/** Normalizes raw values: trims, and maps empty strings to `null`. */
function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function firstHeaderValue(headers: RequestLike['headers'], name: string): string | null {
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return normalize(raw[0]);
  }
  return normalize(raw);
}

/** Reads the tenant id from a request header. */
export function headerExtractor(header = 'x-tenant-id'): TenantExtractor {
  return (request) => firstHeaderValue(request.headers, header);
}

/**
 * Decodes the payload of a `Bearer` JWT and reads a claim from it — without
 * any signature verification (authentication must happen upstream).
 */
export function jwtClaimExtractor(claim = 'tenantId', header = 'authorization'): TenantExtractor {
  return (request) => {
    const authorization = firstHeaderValue(request.headers, header);
    if (authorization === null) {
      return null;
    }
    const [scheme, token] = authorization.split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || token === undefined) {
      return null;
    }
    const payload = decodeJwtPayload(token);
    if (payload === null) {
      return null;
    }
    const value = payload[claim];
    return typeof value === 'string' ? normalize(value) : null;
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3 || segments[1] === undefined || segments[1] === '') {
    return null;
  }
  try {
    const json = Buffer.from(segments[1], 'base64url').toString('utf8');
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolves the tenant from the left-most subdomain relative to `baseDomain`.
 * Exactly one label is accepted (`acme.example.com` → `acme`;
 * `a.b.example.com` → no tenant), so an attacker cannot smuggle an
 * unexpected value through nested subdomains.
 */
export function subdomainExtractor(baseDomain: string): TenantExtractor {
  const base = baseDomain.toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');
  if (base === '') {
    throw new TypeError('subdomainExtractor: baseDomain must be a non-empty domain.');
  }
  return (request) => {
    const host = (request.hostname ?? firstHeaderValue(request.headers, 'host') ?? '')
      .toLowerCase()
      .replace(/:\d+$/, '');
    if (!host.endsWith(`.${base}`)) {
      return null;
    }
    const label = host.slice(0, host.length - base.length - 1);
    if (label === '' || label.includes('.')) {
      return null;
    }
    return label;
  };
}

/** Builds the composed extractor for the options given to `forRoot()`. */
export function createTenantExtractor(options: ExtractionOptions): TenantExtractor {
  switch (options.strategy) {
    case 'header':
      return headerExtractor(options.header);
    case 'jwt':
      return jwtClaimExtractor(options.claim, options.header);
    case 'subdomain':
      return subdomainExtractor(options.baseDomain);
    case 'custom':
      return async (request) => normalize(await options.extractor(request));
  }
}
