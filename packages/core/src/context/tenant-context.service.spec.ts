import { describe, expect, it } from 'vitest';

import { MissingTenantError, TenantContextError } from '../errors';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const service = new TenantContextService();

  describe('getTenantId', () => {
    it('returns undefined outside of any context and never throws', () => {
      expect(service.getTenantId()).toBeUndefined();
    });

    it('returns the tenant bound by run()', () => {
      const seen = service.run('tenant-a', () => service.getTenantId());
      expect(seen).toBe('tenant-a');
    });

    it('returns undefined inside an empty context', () => {
      const seen = service.run(undefined, () => service.getTenantId());
      expect(seen).toBeUndefined();
    });
  });

  describe('run', () => {
    it('returns the callback result', () => {
      expect(service.run('t', () => 42)).toBe(42);
    });

    it('propagates the tenant through async continuations', async () => {
      const seen = await service.run('tenant-async', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getTenantId();
      });
      expect(seen).toBe('tenant-async');
    });

    it('restores the outer context after the callback returns', () => {
      service.run('outer', () => {
        service.run('inner', () => {
          expect(service.getTenantId()).toBe('inner');
        });
        expect(service.getTenantId()).toBe('outer');
      });
      expect(service.getTenantId()).toBeUndefined();
    });

    it('restores the outer context when the callback throws', () => {
      service.run('outer', () => {
        expect(() =>
          service.run('inner', () => {
            throw new Error('boom');
          }),
        ).toThrow('boom');
        expect(service.getTenantId()).toBe('outer');
      });
    });

    it('does not leak between interleaved concurrent chains', async () => {
      const observe = async (tenantId: string): Promise<string | undefined> =>
        service.run(tenantId, async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
          return service.getTenantId();
        });

      const tenants = Array.from({ length: 25 }, (_, i) => `tenant-${i}`);
      const results = await Promise.all(tenants.map(observe));
      expect(results).toEqual(tenants);
    });
  });

  describe('requireTenantId', () => {
    it('returns the tenant when bound', () => {
      expect(service.run('t1', () => service.requireTenantId())).toBe('t1');
    });

    it('throws MissingTenantError outside of a context', () => {
      expect(() => service.requireTenantId()).toThrow(MissingTenantError);
    });

    it('throws MissingTenantError inside an empty context', () => {
      expect(() => service.run(undefined, () => service.requireTenantId())).toThrow(
        MissingTenantError,
      );
    });
  });

  describe('setTenantId', () => {
    it('rebinds the tenant of the active context', () => {
      service.run('before', () => {
        service.setTenantId('after');
        expect(service.getTenantId()).toBe('after');
      });
    });

    it('can bind a tenant into an initially empty context', () => {
      service.run(undefined, () => {
        service.setTenantId('late');
        expect(service.getTenantId()).toBe('late');
      });
    });

    it('only affects the context it was called in', () => {
      service.run('outer', () => {
        service.run('inner', () => {
          service.setTenantId('rebound');
        });
        expect(service.getTenantId()).toBe('outer');
      });
    });

    it('throws TenantContextError outside of a context', () => {
      expect(() => service.setTenantId('nope')).toThrow(TenantContextError);
    });
  });

  describe('isActive', () => {
    it('reflects whether a context is open', () => {
      expect(service.isActive()).toBe(false);
      service.run(undefined, () => {
        expect(service.isActive()).toBe(true);
      });
      service.run('t', () => {
        expect(service.isActive()).toBe(true);
      });
    });
  });
});
