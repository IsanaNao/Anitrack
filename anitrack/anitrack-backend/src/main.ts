import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { ApiErrorExceptionFilter } from './shared/http/api-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
      exceptionFactory(errors) {
        return ApiErrorExceptionFilter.validationException(errors);
      },
    }),
  );

  app.useGlobalFilters(new ApiErrorExceptionFilter());

  const contract = JSON.parse(
    readFileSync(join(process.cwd(), 'swagger.json'), { encoding: 'utf-8' }),
  );

  SwaggerModule.setup('api-docs', app, contract);
  app.use('/swagger.json', (_req: Request, res: Response) => res.json(contract));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}
bootstrap();
