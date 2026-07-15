import { TenantAware } from '@tenantry/typeorm';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Defined in its own module (not inline in the spec) so esbuild applies the
 * package's decorator settings consistently — an inline decorated entity in
 * a test file does not always register reliably.
 */
@TenantAware()
@Entity({ name: 'Project' })
export class ProjectEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  tenantId!: string;

  @Column('text')
  name!: string;
}
