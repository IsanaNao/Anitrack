import { IsString, Matches, MinLength } from 'class-validator';

export class ActivityQueryDto {
  @IsString()
  @MinLength(1)
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Invalid month format (expected YYYY-MM)',
  })
  month!: string; // YYYY-MM
}

