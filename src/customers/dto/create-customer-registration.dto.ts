import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateCustomerRegistrationDto {
  @IsNotEmpty()
  @IsString()
  plate: string;

  @IsNotEmpty()
  date: string;

  @IsNotEmpty()
  @IsInt()
  soatValue: number;

  @IsNotEmpty()
  @IsInt()
  registerValue: number;
}
