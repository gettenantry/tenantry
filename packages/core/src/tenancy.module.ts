import {
  Inject,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';

import { TenantContextService } from './context/tenant-context.service';
import { createTenantExtractor } from './extraction/extractors';
import { TenancyGuard } from './guards/tenancy.guard';
import { TenancyMiddleware } from './middleware/tenancy.middleware';
import { RlsSessionService } from './rls/rls-session.service';
import { TENANCY_MODULE_OPTIONS, TENANT_EXTRACTOR } from './tokens';
import { type TenancyModuleOptions } from './types';

/**
 * Global module wiring tenant extraction into every request.
 *
 * ```ts
 * @Module({
 *   imports: [
 *     TenancyModule.forRoot({
 *       extraction: { strategy: 'header', header: 'x-tenant-id' },
 *     }),
 *   ],
 *   providers: [{ provide: APP_GUARD, useClass: TenancyGuard }],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TenancyModule implements NestModule {
  constructor(@Inject(TENANCY_MODULE_OPTIONS) private readonly options: TenancyModuleOptions) {}

  static forRoot(options: TenancyModuleOptions): DynamicModule {
    return {
      module: TenancyModule,
      global: true,
      providers: [
        { provide: TENANCY_MODULE_OPTIONS, useValue: options },
        {
          provide: TENANT_EXTRACTOR,
          useFactory: (opts: TenancyModuleOptions) => createTenantExtractor(opts.extraction),
          inject: [TENANCY_MODULE_OPTIONS],
        },
        TenantContextService,
        TenancyMiddleware,
        TenancyGuard,
        RlsSessionService,
      ],
      exports: [
        TENANCY_MODULE_OPTIONS,
        TENANT_EXTRACTOR,
        TenantContextService,
        TenancyGuard,
        RlsSessionService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // NestJS 11 (path-to-regexp v8) wildcard; NestJS 10 users can override
    // with `middlewareRoutes: ['*']`.
    const routes = this.options.middlewareRoutes ?? ['{*splat}'];
    consumer
      .apply(TenancyMiddleware)
      .forRoutes(...routes.map((path) => ({ path, method: RequestMethod.ALL })));
  }
}
