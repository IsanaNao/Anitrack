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
import {
  AnimeEntryCreateDto,
  AnimeEntryPatchDto,
  AnimeListQueryDto,
} from './dto/anime-entry.dto';
import { AnimeService } from './anime.service';
import {
  CurrentUser,
  type CurrentUser as CurrentUserType,
} from '../../shared/auth/current-user';

@ApiTags('Anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly anime: AnimeService) {}

  @Get()
  @ApiOperation({ summary: 'List anime entries' })
  @ApiResponse({ status: 200 })
  async list(
    @Query() query: AnimeListQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.anime.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create anime entry' })
  @ApiResponse({ status: 201 })
  async create(
    @Body() body: AnimeEntryCreateDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.anime.create(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get anime entry by id' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200 })
  async get(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.anime.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update anime entry' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200 })
  async patch(
    @Param('id') id: string,
    @Body() body: AnimeEntryPatchDto,
    @Req() req: Request,
    @CurrentUser() user: CurrentUserType,
  ) {
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    return this.anime.patchById(user.id, id, body, rawBody);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete anime entry' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 204 })
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    await this.anime.deleteById(user.id, id);
    return;
  }
}
