import 'reflect-metadata';

import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { runWithTenant } from '../context/tenant-storage';
import { CurrentTenant, currentTenantFactory } from './current-tenant.decorator';

const fakeContext = {} as ExecutionContext;

describe('currentTenantFactory', () => {
  it('returns the tenant bound to the context', () => {
    const seen = runWithTenant('tenant-a', () => currentTenantFactory(undefined, fakeContext));
    expect(seen).toBe('tenant-a');
  });

  it('returns undefined when no tenant is resolved', () => {
    expect(currentTenantFactory(undefined, fakeContext)).toBeUndefined();
    expect(runWithTenant(undefined, () => currentTenantFactory(undefined, fakeContext))).toBe(
      undefined,
    );
  });
});

describe('@CurrentTenant()', () => {
  it('registers route parameter metadata on the handler', () => {
    class ProbeController {
      probe(@CurrentTenant() _tenantId: string | undefined): void {
        void _tenantId;
      }
    }

    const metadata: unknown = Reflect.getMetadata(ROUTE_ARGS_METADATA, ProbeController, 'probe');
    expect(metadata).toBeDefined();
    expect(Object.keys(metadata as Record<string, unknown>)).toHaveLength(1);
  });
});
