import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TenantContextService } from '../context/tenant-context.service';
import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator';
import { TENANCY_MODULE_OPTIONS } from '../tokens';
import { type TenancyModuleOptions } from '../types';

/**
 * Rejects any request for which no tenant was resolved, unless the route (or
 * its controller) is explicitly marked with `@Public()`.
 *
 * Register it globally so multi-tenancy is enforced by default:
 *
 * ```ts
 * providers: [{ provide: APP_GUARD, useClass: TenancyGuard }]
 * ```
 *
 * The thrown exception defaults to a 403 and can be customized via
 * `TenancyModule.forRoot({ guard: { exceptionFactory } })`.
 */
@Injectable()
export class TenancyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    @Optional()
    @Inject(TENANCY_MODULE_OPTIONS)
    private readonly options?: TenancyModuleOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    if (this.tenantContext.getTenantId() === undefined) {
      throw this.createException();
    }
    return true;
  }

  private createException(): Error {
    const factory = this.options?.guard?.exceptionFactory;
    if (factory !== undefined) {
      return factory();
    }
    return new ForbiddenException('Tenant could not be resolved for this request.');
  }
}
