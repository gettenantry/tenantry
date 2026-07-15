import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port);
  console.log(`example-typeorm listening on http://localhost:${port}`);
  console.log(`Try: curl -H "x-tenant-id: acme" http://localhost:${port}/projects`);
}

void bootstrap();
