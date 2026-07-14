import { Injectable, Optional } from '@nestjs/common';

import { UnsafeSqlValueError } from '../errors';

/**
 * Minimal query interface an ORM adapter must expose so the RLS session can
 * be applied through it. Deliberately tiny: any driver or ORM can satisfy it.
 */
export interface RlsQueryExecutor {
  execute(sql: string, parameters: readonly unknown[]): Promise<unknown>;
}

/** A parameterized SQL statement, ready to hand to any driver. */
export interface SqlStatement {
  sql: string;
  parameters: readonly string[];
}

export interface RlsSessionOptions {
  /**
   * PostgreSQL session variable carrying the current tenant. Custom GUCs
   * must contain a dot. @default 'app.current_tenant'
   */
  variable?: string;
}

const VARIABLE_PATTERN = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Manages the PostgreSQL session variable that Row-Level Security policies
 * read (`current_setting('app.current_tenant', true)`).
 *
 * This is the single place RLS logic lives — every ORM adapter reuses it
 * instead of reimplementing session binding.
 *
 * The tenant is bound with `SELECT set_config($1, $2, true)` rather than
 * `SET LOCAL …`: `set_config` accepts bind parameters, so the tenant id is
 * never interpolated into SQL text. The `true` argument scopes the value to
 * the enclosing transaction — it resets automatically at commit/rollback and
 * therefore cannot leak across pooled connections.
 */
@Injectable()
export class RlsSessionService {
  readonly variable: string;

  constructor(@Optional() options?: RlsSessionOptions) {
    const variable = options?.variable ?? 'app.current_tenant';
    if (!VARIABLE_PATTERN.test(variable)) {
      throw new UnsafeSqlValueError(
        `Invalid RLS session variable "${variable}": expected a lowercase ` +
          'dotted name such as "app.current_tenant".',
      );
    }
    this.variable = variable;
  }

  /**
   * Statement binding the tenant to the current transaction
   * (`SET LOCAL`-equivalent, fully parameterized).
   */
  buildSetTenantStatement(tenantId: string): SqlStatement {
    this.assertValidTenantId(tenantId);
    return {
      sql: 'SELECT set_config($1, $2, true)',
      parameters: [this.variable, tenantId],
    };
  }

  /** Applies the tenant binding through the given executor. */
  async applyTenant(executor: RlsQueryExecutor, tenantId: string): Promise<void> {
    const statement = this.buildSetTenantStatement(tenantId);
    await executor.execute(statement.sql, statement.parameters);
  }

  /**
   * DDL enabling — and forcing — Row-Level Security on a table.
   *
   * `FORCE` matters: without it the table owner silently bypasses every
   * policy, which is exactly the kind of failure this library exists to
   * prevent. (PostgreSQL superusers always bypass RLS; the application must
   * connect with a regular role.)
   */
  buildEnableRlsDdl(table: string): string[] {
    const quoted = this.quoteIdentifier(table);
    return [
      `ALTER TABLE ${quoted} ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE ${quoted} FORCE ROW LEVEL SECURITY`,
    ];
  }

  /**
   * DDL creating the tenant isolation policy for a table. The policy applies
   * to reads and writes (`USING` + `WITH CHECK`), and evaluates to false when
   * no tenant is bound (`current_setting(..., true)` returns NULL).
   */
  buildTenantPolicyDdl(
    table: string,
    tenantColumn: string,
    policyName = 'tenant_isolation',
  ): string {
    const quotedTable = this.quoteIdentifier(table);
    const quotedColumn = this.quoteIdentifier(tenantColumn);
    const quotedPolicy = this.quoteIdentifier(policyName);
    const setting = `current_setting('${this.variable}', true)`;
    return (
      `CREATE POLICY ${quotedPolicy} ON ${quotedTable} ` +
      `USING (${quotedColumn} = ${setting}) ` +
      `WITH CHECK (${quotedColumn} = ${setting})`
    );
  }

  private assertValidTenantId(tenantId: string): void {
    if (typeof tenantId !== 'string' || tenantId.length === 0 || tenantId.includes('\0')) {
      throw new UnsafeSqlValueError('Tenant id must be a non-empty string without NUL characters.');
    }
  }

  private quoteIdentifier(identifier: string): string {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      throw new UnsafeSqlValueError(
        `Invalid SQL identifier "${identifier}": only letters, digits and ` +
          'underscores are allowed (quoting arbitrary identifiers is out of scope).',
      );
    }
    return `"${identifier}"`;
  }
}
