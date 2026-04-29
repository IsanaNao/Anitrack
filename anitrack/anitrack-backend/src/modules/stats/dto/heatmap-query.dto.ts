import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class HeatmapQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Invalid month format (expected YYYY-MM)',
  })
  start?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Invalid month format (expected YYYY-MM)',
  })
  end?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'tz must be non-empty when provided' })
  tz?: string;
}
