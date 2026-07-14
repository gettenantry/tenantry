import 'reflect-metadata';

import { RequestMethod, type MiddlewareConsumer } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { TenantContextService } from './context/tenant-context.service';
import { TenancyGuard } from './guards/tenancy.guard';
import { TenancyMiddleware } from './middleware/tenancy.middleware';
import { RlsSessionService } from './rls/rls-session.service';
import { TenancyModule } from './tenancy.module';
import { TENANCY_MODULE_OPTIONS, TENANT_EXTRACTOR } from './tokens';
import { type TenancyModuleOptions, type TenantExtractor } from './types';

const options: TenancyModuleOptions = { extraction: { strategy: 'header' } };

interface FactoryProvider {
  provide: unknown;
  useFactory?: (opts: TenancyModuleOptions) => TenantExtractor;
  useValue?: unknown;
}

describe('TenancyModule.forRoot', () => {
  const dynamicModule = TenancyModule.forRoot(options);

  it('registers a global module exposing the core providers', () => {
    expect(dynamicModule.global).toBe(true);
    expect(dynamicModule.module).toBe(TenancyModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        TenantContextService,
        TenancyMiddleware,
        TenancyGuard,
        RlsSessionService,
      ]),
    );
    expect(dynamicModule.exports).toEqual(
      expect.arrayContaining([TENANCY_MODULE_OPTIONS, TENANT_EXTRACTOR, TenantContextService]),
    );
  });

  it('provides the options and a working extractor factory', async () => {
    const providers = (dynamicModule.providers ?? []) as FactoryProvider[];
    const optionsProvider = providers.find((p) => p.provide === TENANCY_MODULE_OPTIONS);
    expect(optionsProvider?.useValue).toBe(options);

    const extractorProvider = providers.find((p) => p.provide === TENANT_EXTRACTOR);
    const extractor = extractorProvider?.useFactory?.(options);
    expect(extractor).toBeTypeOf('function');
    expect(await extractor?.({ headers: { 'x-tenant-id': 'acme' } })).toBe('acme');
  });
});

describe('TenancyModule.configure', () => {
  function consumerSpy(): {
    consumer: MiddlewareConsumer;
    apply: ReturnType<typeof vi.fn>;
    forRoutes: ReturnType<typeof vi.fn>;
  } {
    const forRoutes = vi.fn();
    const apply = vi.fn(() => ({ forRoutes }));
    const consumer = { apply } as unknown as MiddlewareConsumer;
    return { consumer, apply, forRoutes };
  }

  it('applies the middleware to every route by default (NestJS 11 wildcard)', () => {
    const { consumer, apply, forRoutes } = consumerSpy();
    new TenancyModule(options).configure(consumer);
    expect(apply).toHaveBeenCalledWith(TenancyMiddleware);
    expect(forRoutes).toHaveBeenCalledWith({ path: '{*splat}', method: RequestMethod.ALL });
  });

  it('honors custom middleware routes (e.g. NestJS 10 syntax)', () => {
    const { consumer, forRoutes } = consumerSpy();
    new TenancyModule({ ...options, middlewareRoutes: ['*', '/api/*'] }).configure(consumer);
    expect(forRoutes).toHaveBeenCalledWith(
      { path: '*', method: RequestMethod.ALL },
      { path: '/api/*', method: RequestMethod.ALL },
    );
  });
});
