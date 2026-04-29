import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AnimeMetaSearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  pageSize?: number;
}

export type JikanPagination = {
  last_visible_page?: number;
  has_next_page?: boolean;
  current_page?: number;
  items?: {
    count?: number;
    total?: number;
    per_page?: number;
  };
};

export type AnimeMetaSearchResponseDto = {
  items: any[];
  pagination: JikanPagination;
};
