import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'UsernameOrEmail', async: false })
class UsernameOrEmailConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const obj = args.object as LoginDto;
    return Boolean(obj.username || obj.email);
  }
  defaultMessage() {
    return 'Either username or email is required';
  }
}

export class LoginDto {
  @ApiProperty({ example: 'johndoe', required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsString()
  username?: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({ example: 'StrongP@ss1' })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  @Validate(UsernameOrEmailConstraint)
  password!: string;
}
