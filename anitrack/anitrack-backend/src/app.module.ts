import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnimeModule } from './modules/anime/anime.module';
import { StatsModule } from './modules/stats/stats.module';
import { BeeModule } from './modules/bee/bee.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      // Be resilient to different working directories (e.g. started from repo root vs backend folder).
      envFilePath: [
        join(process.cwd(), '.env'),
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '..', '.env'),
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI')?.trim();
        if (!uri) {
          // 允许在未配置真实 Atlas 时先启动 Swagger/开发服务器；
          // 若本机无 MongoDB，相关接口会在连接失败时返回错误或重试日志。
          // 真实协作时请在 `.env` 中配置 MONGODB_URI。

          console.warn(
            '[anitrack-backend] Missing MONGODB_URI; falling back to localhost MongoDB.',
          );
        }
        return {
          uri: uri || 'mongodb://127.0.0.1:27017/anitrack',
          bufferCommands: false,
          // If a real URI is provided (tests / production), connect eagerly.
          // If not, keep Swagger bootable without a running Mongo instance.
          lazyConnection: !uri,
        };
      },
    }),
    AnimeModule,
    StatsModule,
    BeeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
