import { describe, expect, it } from 'vitest';

import { TENANTRY_VERSION } from './index';

describe('@tenantry/core package stub', () => {
  it('exposes the pre-release version marker', () => {
    expect(TENANTRY_VERSION).toBe('0.0.0');
  });
});
