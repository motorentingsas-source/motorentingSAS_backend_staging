import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';
import {
  ValidateIf,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { DeliveryState, SaleState, Origin } from '@prisma/client';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ValidateIf((o) => o.deliveryState === DeliveryState.ENTREGADO)
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsDateString()
  birthdate: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsOptional()
  @IsEnum(SaleState)
  saleState?: SaleState;

  @IsOptional()
  @IsEnum(Origin)
  origin?: Origin;
}
