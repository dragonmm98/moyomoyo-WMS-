import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@moyomoyo.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "MoyomoyoAdmin1" })
  @IsString()
  @MinLength(8)
  password!: string;
}
