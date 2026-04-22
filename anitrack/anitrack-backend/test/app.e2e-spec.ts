import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication<App>;
  let mongo: MongoMemoryServer | null = null;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
      mongo = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongo.getUri('anitrack_e2e');
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});
