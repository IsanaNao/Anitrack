import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class HeatmapQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (expected YYYY-MM-DD)',
  })
  to?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'tz must be non-empty when provided' })
  tz?: string;
}

