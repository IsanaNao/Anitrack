import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AnimeStatusValues } from '../anime.constants';

export class AnimeEntryCreateDto {
  @IsInt()
  @Min(0)
  malId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  title!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsIn(AnimeStatusValues)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  startedAt?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  completedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3660)
  @ArrayUnique()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  completedDates?: string[];
}

export class AnimeEntryPatchDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  malId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  title?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsIn(AnimeStatusValues)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  startedAt?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  completedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3660)
  @ArrayUnique()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  completedDates?: string[];
}

export class AnimeListQueryDto {
  @IsOptional()
  @IsIn(AnimeStatusValues)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sort?: string;
}

