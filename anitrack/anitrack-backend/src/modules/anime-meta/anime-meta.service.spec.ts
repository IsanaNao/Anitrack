import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { AnimeMetaService } from './anime-meta.service';
import { AnimeMeta } from './schemas/anime-meta.schema';

describe('AnimeMetaService (cache-aside)', () => {
  const malId = 52991;

  let svc: AnimeMetaService;
  let model: {
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnimeMetaService,
        { provide: getModelToken(AnimeMeta.name), useValue: model },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://api.jikan.moe/v4') },
        },
      ],
    }).compile();

    svc = moduleRef.get(AnimeMetaService);
  });

  afterEach(() => {
    // @ts-expect-error test-only cleanup
    globalThis.fetch = undefined;
    jest.restoreAllMocks();
  });

  it('当 AnimeMeta 已存在时：不触发 Jikan 调用', async () => {
    const existing = { malId, title: 'Frieren', imageUrl: 'x', episodes: 28, score: 9.1 };
    model.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(existing),
    });

    const fetchSpy = jest.fn();
    // @ts-expect-error node test environment mock
    globalThis.fetch = fetchSpy;

    const got = await svc.getOrFetchByMalId(malId);

    expect(got).toEqual(existing);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('当 AnimeMeta 不存在时：抓取 Jikan 并写入缓存', async () => {
    model.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          mal_id: malId,
          title: 'Frieren',
          episodes: 28,
          score: 9.1,
          images: { jpg: { image_url: 'https://cdn.example/cover.jpg' } },
        },
      }),
    });
    // @ts-expect-error node test environment mock
    globalThis.fetch = fetchSpy;

    model.create.mockResolvedValue({
      toJSON: () => ({
        id: 'doc1',
        malId,
        title: 'Frieren',
        imageUrl: 'https://cdn.example/cover.jpg',
        episodes: 28,
        score: 9.1,
      }),
    });

    const got = await svc.getOrFetchByMalId(malId);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(model.create).toHaveBeenCalledWith({
      malId,
      title: 'Frieren',
      imageUrl: 'https://cdn.example/cover.jpg',
      episodes: 28,
      score: 9.1,
    });
    expect(got).toMatchObject({ malId, title: 'Frieren' });
  });
});

