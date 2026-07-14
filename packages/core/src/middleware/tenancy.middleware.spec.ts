import { describe, expect, it } from 'vitest';

import { TenantContextService } from '../context/tenant-context.service';
import { type RequestLike } from '../types';
import { TenancyMiddleware } from './tenancy.middleware';

const tenantContext = new TenantContextService();

describe('TenancyMiddleware', () => {
  it('runs the downstream pipeline inside the extracted tenant context', async () => {
    const middleware = new TenancyMiddleware(
      (req: RequestLike) => req.headers['x-tenant-id'] as string,
      tenantContext,
    );

    let seen: string | undefined;
    await middleware.use({ headers: { 'x-tenant-id': 'acme' } }, undefined, () => {
      seen = tenantContext.getTenantId();
    });
    expect(seen).toBe('acme');
  });

  it('opens an empty context when the extractor resolves nothing', async () => {
    const middleware = new TenancyMiddleware(() => null, tenantContext);

    let active: boolean | undefined;
    let seen: string | undefined = 'sentinel';
    await middleware.use({ headers: {} }, undefined, () => {
      active = tenantContext.isActive();
      seen = tenantContext.getTenantId();
    });
    expect(active).toBe(true);
    expect(seen).toBeUndefined();
  });

  it('awaits asynchronous extractors', async () => {
    const middleware = new TenancyMiddleware(() => Promise.resolve('async-tenant'), tenantContext);

    let seen: string | undefined;
    await middleware.use({ headers: {} }, undefined, () => {
      seen = tenantContext.getTenantId();
    });
    expect(seen).toBe('async-tenant');
  });

  it('propagates extractor failures instead of swallowing them', async () => {
    const middleware = new TenancyMiddleware(
      () => Promise.reject(new Error('extractor blew up')),
      tenantContext,
    );
    await expect(middleware.use({ headers: {} }, undefined, () => undefined)).rejects.toThrow(
      'extractor blew up',
    );
  });
});
