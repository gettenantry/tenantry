import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { CurrentTenant } from '@tenantry/core';

import { PrismaService } from './prisma.service';

interface CreateProjectDto {
  name: string;
}

/**
 * Note what is ABSENT here: no tenantId in any query. The Tenantry Prisma
 * extension scopes every operation to the current tenant automatically, and
 * PostgreSQL RLS backs it up at the database level.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentTenant() tenant: string): Promise<unknown> {
    console.log(`listing projects for tenant "${tenant}"`);
    return this.prisma.client.project.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<unknown> {
    const project = await this.prisma.client.project.findUnique({ where: { id } });
    if (project === null) {
      // Another tenant's project id lands here too: it is simply not found.
      throw new NotFoundException();
    }
    return project;
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentTenant() tenantId: string): Promise<unknown> {
    // The generated Prisma types require tenantId on create. The decorator
    // provides it — and the extension enforces it matches the context, so a
    // spoofed value could never land anyway.
    return this.prisma.client.project.create({ data: { name: dto.name, tenantId } });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    const result = await this.prisma.client.project.deleteMany({ where: { id } });
    return { deleted: result.count === 1 };
  }
}
