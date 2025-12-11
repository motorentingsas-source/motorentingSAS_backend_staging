import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FinancialEntity, SaleState, Distributor } from '@prisma/client';

export class HolderDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  document: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsEnum(FinancialEntity)
  financialEntity: FinancialEntity;
}

export class PurchaseDto {
  @IsString()
  brand: string;

  @IsString()
  reference: string;

  @IsString()
  mainColor: string;

  @IsOptional()
  @IsString()
  optionalColor?: string;

  @IsNumber()
  commercialValue: number;

  @IsNumber()
  processValue: number;

  @IsNumber()
  totalValue: number;
}

export class PaymentDto {
  @IsEnum(FinancialEntity)
  financialEntity: FinancialEntity;

  @IsNumber()
  totalPayment: number;

  @IsNumber()
  aval: number;

  @IsOptional()
  @Type(() => Date)
  approvalDate?: Date;
}

export class ReceiptDto {
  @IsString()
  receiptNumber: string;

  @IsOptional()
  @Type(() => Date)
  date: Date;

  @IsNumber()
  amount: number;
}

export class ApproveCustomerDto {
  @IsEnum(SaleState)
  saleState: SaleState;

  @IsEnum(Distributor)
  distributor: Distributor;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HolderDto)
  holders?: HolderDto[];

  @ValidateNested()
  @Type(() => PurchaseDto)
  purchase: PurchaseDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments?: PaymentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptDto)
  receipts?: ReceiptDto[];

  @IsOptional()
  @IsDateString()
  approvalDate?: string;
}
