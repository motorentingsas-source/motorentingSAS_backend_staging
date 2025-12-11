import {
  IsArray,
  IsOptional,
  ArrayNotEmpty,
  IsString,
  IsDateString,
  IsNumber,
} from 'class-validator';

export class StatisticsDto {
  @IsArray()
  @ArrayNotEmpty()
  advisors: number[];

  @IsNumber()
  status: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
