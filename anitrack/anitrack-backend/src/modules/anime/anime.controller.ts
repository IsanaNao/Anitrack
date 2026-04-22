import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AnimeEntryCreateDto, AnimeEntryPatchDto, AnimeListQueryDto } from './dto/anime-entry.dto';
import { AnimeService } from './anime.service';

@ApiTags('Anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly anime: AnimeService) {}

  @Get()
  @ApiOperation({ summary: 'List anime entries' })
  @ApiResponse({ status: 200 })
  async list(@Query() query: AnimeListQueryDto) {
    return this.anime.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create anime entry' })
  @ApiResponse({ status: 201 })
  async create(@Body() body: AnimeEntryCreateDto) {
    return this.anime.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get anime entry by id' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200 })
  async get(@Param('id') id: string) {
    return this.anime.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update anime entry' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200 })
  async patch(
    @Param('id') id: string,
    @Body() body: AnimeEntryPatchDto,
    @Req() req: Request,
  ) {
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    return this.anime.patchById(id, body, rawBody);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete anime entry' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 204 })
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.anime.deleteById(id);
    return;
  }
}

