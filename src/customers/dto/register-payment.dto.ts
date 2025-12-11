import { IsString, IsNumber, IsDateString } from 'class-validator';

export class RegisterPaymentDto {
  @IsString()
  receiptNumber: string;

  @IsDateString()
  date: string;

  @IsNumber()
  amount: number;
}
