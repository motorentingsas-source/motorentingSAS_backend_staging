import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateCustomerInvoiceDto {
  @IsNotEmpty()
  @IsString()
  invoiceNumber: string;

  @IsNotEmpty()
  date: string;

  @IsNotEmpty()
  @IsInt()
  value: number;

  @IsNotEmpty()
  @IsString()
  chassisNumber: string;

  @IsNotEmpty()
  @IsString()
  engineNumber: string;
}
