import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AnimeMetaService } from '../src/modules/anime-meta/anime-meta.service';
import { ApiErrorExceptionFilter } from '../src/shared/http/api-error.filter';

function expectErrorEnvelope(body: any) {
  expect(body).toHaveProperty('error');
  expect(body.error).toHaveProperty('code');
  expect(body.error).toHaveProperty('message');
  expect(body.error).toHaveProperty('details');
  expect(Array.isArray(body.error.details)).toBe(true);
}

describe('NestJS backend smoke (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication<App>;
  let mongo: MongoMemoryServer | null = null;

  beforeAll(async () => {
    // Prefer real DB if provided; otherwise use in-memory MongoDB.
    if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
      mongo = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongo.getUri('anitrack_smoke');
    }

    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AnimeMetaService)
      .useValue({
        findByMalIds: async (malIds: number[]) =>
          malIds.map((malId) => ({ malId, title: `mock-title-${malId}`, imageUrl: 'https://example.com/x.jpg' })),
        getOrFetchByMalId: async (malId: number) => ({
          malId,
          title: `mock-title-${malId}`,
          imageUrl: 'https://example.com/x.jpg',
          episodes: 1,
          score: 8.8,
        }),
      })
      .compile();

    app = modRef.createNestApplication();

    // Mirror main.ts behavior for consistent validation + error envelope.
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

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  afterEach(async () => {
    // Keep tests isolated.
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.dropDatabase();
    }
  });

  it('heatmap contract: GET /api/stats/heatmap returns weeks with weekStart+days[count,intensity]', async () => {
    // Ensure DB connection is established before aggregation (avoids first-call 500 in some environments).
    await request(app.getHttpServer())
      .post('/api/anime')
      .send({ malId: 999000, status: 'COMPLETED' })
      .expect(201);

    const res = await request(app.getHttpServer()).get('/api/stats/heatmap').expect(200);

    expect(res.body).toHaveProperty('from');
    expect(res.body).toHaveProperty('to');
    expect(Array.isArray(res.body.weeks)).toBe(true);

    // structure check (no dependency on seeded data)
    if (res.body.weeks.length > 0) {
      const w = res.body.weeks[0];
      expect(w).toHaveProperty('weekStart');
      expect(Array.isArray(w.days)).toBe(true);
      if (w.days.length > 0) {
        const d = w.days[0];
        expect(d).toHaveProperty('count');
        expect(d).toHaveProperty('intensity');
      }
    }
  });

  it('state machine: invalid transition returns 409 INVALID_STATUS_TRANSITION envelope', async () => {
    // Create DROPPED
    const created = await request(app.getHttpServer())
      .post('/api/anime')
      .send({ malId: 999001, status: 'DROPPED' })
      .expect(201);

    const id = created.body?.id;
    expect(typeof id).toBe('string');

    // DROPPED -> WATCHING is forbidden (must go to PLANNED first)
    const res = await request(app.getHttpServer())
      .patch(`/api/anime/${id}`)
      .send({ status: 'WATCHING' })
      .expect(409);

    expectErrorEnvelope(res.body);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('data flow: create -> get -> patch -> delete', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/anime')
      .send({ malId: 999002, status: 'PLANNED' })
      .expect(201);

    const id = created.body?.id;
    expect(typeof id).toBe('string');

    await request(app.getHttpServer()).get(`/api/anime/${id}`).expect(200);

    // Mark completed; server will auto-maintain completedAt/completedDates.
    const patched = await request(app.getHttpServer())
      .patch(`/api/anime/${id}`)
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(patched.body.status).toBe('COMPLETED');

    await request(app.getHttpServer()).delete(`/api/anime/${id}`).expect(204);

    const after = await request(app.getHttpServer()).get(`/api/anime/${id}`).expect(404);
    expectErrorEnvelope(after.body);
    expect(after.body.error.code).toBe('NOT_FOUND');
  });
});

