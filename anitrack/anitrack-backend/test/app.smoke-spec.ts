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

  function randomMalId() {
    // Avoid collisions with any persistent dev DB.
    return 2_000_000_000 + Math.floor(Math.random() * 100_000_000);
  }

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
          malIds.map((malId) => ({
            malId,
            title: `mock-title-${malId}`,
            imageUrl: 'https://example.com/x.jpg',
          })),
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

  it('heatmap contract: GET /api/stats/heatmap returns start/end/months[]', async () => {
    // Ensure DB connection is established before aggregation (avoids first-call 500 in some environments).
    const malId = randomMalId();
    await request(app.getHttpServer())
      .post('/api/anime')
      .send({ malId, status: 'COMPLETED' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/stats/heatmap')
      .expect(200);

    expect(res.body).toHaveProperty('start');
    expect(res.body).toHaveProperty('end');
    expect(Array.isArray(res.body.months)).toBe(true);

    // structure check (no dependency on seeded data)
    if (res.body.months.length > 0) {
      const m = res.body.months[0];
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('addedCount');
      expect(m).toHaveProperty('completedCount');
      expect(m).toHaveProperty('episodeCount');
      expect(m).toHaveProperty('intensity');
    }
  });

  it('heatmap validation: start > end returns 400 VALIDATION_ERROR envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats/heatmap?start=2026-05&end=2026-04')
      .expect(400);

    expectErrorEnvelope(res.body);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('heatmap validation: invalid tz returns 400 VALIDATION_ERROR envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats/heatmap?tz=Invalid/Timezone')
      .expect(400);

    expectErrorEnvelope(res.body);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('state machine: invalid transition returns 409 INVALID_STATUS_TRANSITION envelope', async () => {
    // Create DROPPED
    const malId = randomMalId();
    const created = await request(app.getHttpServer())
      .post('/api/anime')
      .send({ malId, status: 'DROPPED' })
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
    const malId = randomMalId();
    const created = await request(app.getHttpServer())
      .post('/api/anime')
      .send({ malId, status: 'PLANNED' })
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

    const after = await request(app.getHttpServer())
      .get(`/api/anime/${id}`)
      .expect(404);
    expectErrorEnvelope(after.body);
    expect(after.body.error.code).toBe('NOT_FOUND');
  });
});
