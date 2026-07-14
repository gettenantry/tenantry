import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';

import { TenantContextService } from '../context/tenant-context.service';
import { TENANT_EXTRACTOR } from '../tokens';
import { type RequestLike, type TenantExtractor } from '../types';

/**
 * Opens the tenant context for every incoming request: runs the configured
 * extractor, then wraps the rest of the request pipeline (guards included)
 * in `TenantContextService.run()`.
 *
 * An unresolved tenant opens an *empty* context — rejection is the guard's
 * decision, not the extractor's.
 */
@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_EXTRACTOR) private readonly extractor: TenantExtractor,
    private readonly tenantContext: TenantContextService,
  ) {}

  async use(
    request: RequestLike,
    _response: unknown,
    next: (error?: unknown) => void,
  ): Promise<void> {
    const tenantId = await this.extractor(request);
    this.tenantContext.run(tenantId ?? undefined, () => {
      next();
    });
  }
}
