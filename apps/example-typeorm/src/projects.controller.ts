import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { CurrentTenant } from '@tenantry/core';

import { DatabaseService } from './database.service';

interface CreateProjectDto {
  name: string;
}

/**
 * Same routes as example-prisma's controller — and the same absence: no
 * tenant-filtering logic. The TenantBaseRepository scopes every read, the
 * TenantSubscriber stamps every write, and PostgreSQL RLS backs both up.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  list(@CurrentTenant() tenant: string): Promise<unknown> {
    console.log(`listing projects for tenant "${tenant}"`);
    return this.db.projects.find({ order: { createdAt: 'DESC' } });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<unknown> {
    const project = await this.db.projects.findOneBy({ id });
    if (project === null) {
      // Another tenant's project id lands here too: it is simply not found.
      throw new NotFoundException();
    }
    return project;
  }

  @Post()
  create(@Body() dto: CreateProjectDto): Promise<unknown> {
    // No tenantId here at all: the subscriber stamps it from the context.
    return this.db.projects.save({ name: dto.name });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const result = await this.db.projects.delete({ id });
    return { deleted: result.affected === 1 };
  }
}
