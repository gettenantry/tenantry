import 'reflect-metadata';

import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { TenantContextService } from '../context/tenant-context.service';
import { Public } from '../decorators/public.decorator';
import { TenancyGuard } from './tenancy.guard';

class OpenController {
  @Public()
  publicRoute(): void {
    /* test handler */
  }

  protectedRoute(): void {
    /* test handler */
  }
}

@Public()
class FullyPublicController {
  anyRoute(): void {
    /* test handler */
  }
}

function contextFor(
  controller: new () => object,
  handlerName: 'publicRoute' | 'protectedRoute' | 'anyRoute',
): ExecutionContext {
  const prototype = controller.prototype as Record<string, () => void>;
  const handler = prototype[handlerName];
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

const tenantContext = new TenantContextService();

describe('TenancyGuard', () => {
  const guard = new TenancyGuard(new Reflector(), tenantContext);

  it('allows requests with a resolved tenant', () => {
    const allowed = tenantContext.run('acme', () =>
      guard.canActivate(contextFor(OpenController, 'protectedRoute')),
    );
    expect(allowed).toBe(true);
  });

  it('rejects tenant-less requests with a 403 by default', () => {
    tenantContext.run(undefined, () => {
      expect(() => guard.canActivate(contextFor(OpenController, 'protectedRoute'))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('rejects requests outside of any context', () => {
    expect(() => guard.canActivate(contextFor(OpenController, 'protectedRoute'))).toThrow(
      ForbiddenException,
    );
  });

  it('lets tenant-less requests through @Public() handlers', () => {
    expect(guard.canActivate(contextFor(OpenController, 'publicRoute'))).toBe(true);
  });

  it('lets tenant-less requests through @Public() controllers', () => {
    expect(guard.canActivate(contextFor(FullyPublicController, 'anyRoute'))).toBe(true);
  });

  it('uses the configured exception factory', () => {
    const custom = new TenancyGuard(new Reflector(), tenantContext, {
      extraction: { strategy: 'header' },
      guard: { exceptionFactory: () => new UnauthorizedException('who are you?') },
    });
    expect(() => custom.canActivate(contextFor(OpenController, 'protectedRoute'))).toThrow(
      UnauthorizedException,
    );
  });

  it('still checks the tenant when options carry no factory', () => {
    const withOptions = new TenancyGuard(new Reflector(), tenantContext, {
      extraction: { strategy: 'header' },
    });
    expect(() => withOptions.canActivate(contextFor(OpenController, 'protectedRoute'))).toThrow(
      ForbiddenException,
    );
  });
});
