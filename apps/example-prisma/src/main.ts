import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  console.log(`example-prisma listening on http://localhost:${port}`);
  console.log('Try: curl -H "x-tenant-id: acme" http://localhost:3000/projects');
}

void bootstrap();
