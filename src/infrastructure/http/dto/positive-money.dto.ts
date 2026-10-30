import { Matches, MaxLength, IsString, Length } from 'class-validator';

export class PositiveMoneyDto {
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,16}(?:\.\d{1,2})?$/)
  @MaxLength(19)
  amount!: string;

  @IsString()
  @Length(3, 3)
  @Matches(/^[a-zA-Z]{3}$/)
  currency!: string;
}
