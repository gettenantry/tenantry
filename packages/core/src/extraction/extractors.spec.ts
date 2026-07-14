import { describe, expect, it } from 'vitest';

import { type RequestLike } from '../types';
import {
  createTenantExtractor,
  headerExtractor,
  jwtClaimExtractor,
  subdomainExtractor,
} from './extractors';

function request(partial: Partial<RequestLike>): RequestLike {
  return { headers: {}, ...partial };
}

function bearer(payload: unknown): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `Bearer ${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

describe('headerExtractor', () => {
  const extract = headerExtractor();

  it('reads the default x-tenant-id header', () => {
    expect(extract(request({ headers: { 'x-tenant-id': 'acme' } }))).toBe('acme');
  });

  it('is case-insensitive on the configured header name', () => {
    expect(
      headerExtractor('X-Custom-Tenant')(request({ headers: { 'x-custom-tenant': 'acme' } })),
    ).toBe('acme');
  });

  it('takes the first value of a multi-value header', () => {
    expect(extract(request({ headers: { 'x-tenant-id': ['first', 'second'] } }))).toBe('first');
  });

  it('trims whitespace and rejects empty values', () => {
    expect(extract(request({ headers: { 'x-tenant-id': '  acme  ' } }))).toBe('acme');
    expect(extract(request({ headers: { 'x-tenant-id': '   ' } }))).toBeNull();
    expect(extract(request({ headers: { 'x-tenant-id': [] } }))).toBeNull();
  });

  it('returns null when the header is absent', () => {
    expect(extract(request({}))).toBeNull();
  });
});

describe('jwtClaimExtractor', () => {
  const extract = jwtClaimExtractor();

  it('reads the default tenantId claim from a bearer token', () => {
    const headers = { authorization: bearer({ sub: 'u1', tenantId: 'acme' }) };
    expect(extract(request({ headers }))).toBe('acme');
  });

  it('supports a custom claim and a custom header', () => {
    const extractCustom = jwtClaimExtractor('org', 'x-forwarded-jwt');
    const headers = { 'x-forwarded-jwt': bearer({ org: 'globex' }) };
    expect(extractCustom(request({ headers }))).toBe('globex');
  });

  it('accepts a case-insensitive bearer scheme', () => {
    const headers = { authorization: bearer({ tenantId: 'acme' }).replace('Bearer', 'bearer') };
    expect(extract(request({ headers }))).toBe('acme');
  });

  it('returns null when the header is absent or not a bearer token', () => {
    expect(extract(request({}))).toBeNull();
    expect(extract(request({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }))).toBeNull();
    expect(extract(request({ headers: { authorization: 'Bearer' } }))).toBeNull();
  });

  it('returns null for malformed tokens', () => {
    expect(extract(request({ headers: { authorization: 'Bearer not-a-jwt' } }))).toBeNull();
    expect(extract(request({ headers: { authorization: 'Bearer a..c' } }))).toBeNull();
    expect(extract(request({ headers: { authorization: 'Bearer a.%%%%.c' } }))).toBeNull();
  });

  it('returns null when the payload is not a JSON object', () => {
    const encode = (raw: string): string => Buffer.from(raw).toString('base64url');
    for (const payload of ['"just-a-string"', '[1,2]', 'null', '42']) {
      const token = `Bearer x.${encode(payload)}.y`;
      expect(extract(request({ headers: { authorization: token } }))).toBeNull();
    }
  });

  it('returns null when the claim is missing or not a string', () => {
    expect(extract(request({ headers: { authorization: bearer({ sub: 'u1' }) } }))).toBeNull();
    expect(extract(request({ headers: { authorization: bearer({ tenantId: 7 }) } }))).toBeNull();
    expect(extract(request({ headers: { authorization: bearer({ tenantId: ' ' }) } }))).toBeNull();
  });
});

describe('subdomainExtractor', () => {
  const extract = subdomainExtractor('example.com');

  it('resolves the left-most label relative to the base domain', () => {
    expect(extract(request({ hostname: 'acme.example.com' }))).toBe('acme');
  });

  it('falls back to the host header when hostname is absent', () => {
    expect(extract(request({ headers: { host: 'acme.example.com' } }))).toBe('acme');
  });

  it('strips the port and lowercases the host', () => {
    expect(extract(request({ headers: { host: 'ACME.Example.COM:3000' } }))).toBe('acme');
  });

  it('rejects the bare base domain and unrelated hosts', () => {
    expect(extract(request({ hostname: 'example.com' }))).toBeNull();
    expect(extract(request({ hostname: 'evil-example.com' }))).toBeNull();
    expect(extract(request({ hostname: 'other.io' }))).toBeNull();
    expect(extract(request({})) as unknown).toBeNull();
  });

  it('rejects nested subdomains (exactly one label allowed)', () => {
    expect(extract(request({ hostname: 'a.b.example.com' }))).toBeNull();
  });

  it('normalizes stray dots around the configured base domain', () => {
    const extractDotted = subdomainExtractor('.example.com.');
    expect(extractDotted(request({ hostname: 'acme.example.com' }))).toBe('acme');
  });

  it('throws on an empty base domain', () => {
    expect(() => subdomainExtractor('..')).toThrow(TypeError);
  });
});

describe('createTenantExtractor', () => {
  it('builds each built-in strategy', async () => {
    const header = createTenantExtractor({ strategy: 'header' });
    expect(await header(request({ headers: { 'x-tenant-id': 'a' } }))).toBe('a');

    const jwt = createTenantExtractor({ strategy: 'jwt' });
    expect(await jwt(request({ headers: { authorization: bearer({ tenantId: 'b' }) } }))).toBe('b');

    const subdomain = createTenantExtractor({ strategy: 'subdomain', baseDomain: 'x.io' });
    expect(await subdomain(request({ hostname: 'c.x.io' }))).toBe('c');
  });

  it('wraps custom extractors and normalizes their output', async () => {
    const custom = createTenantExtractor({
      strategy: 'custom',
      extractor: () => Promise.resolve('  spaced  '),
    });
    expect(await custom(request({}))).toBe('spaced');

    const empty = createTenantExtractor({ strategy: 'custom', extractor: () => '' });
    expect(await empty(request({}))).toBeNull();

    const nullish = createTenantExtractor({ strategy: 'custom', extractor: () => undefined });
    expect(await nullish(request({}))).toBeNull();
  });
});
