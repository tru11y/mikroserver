import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateAccessDto {
  @ApiPropertyOptional({ example: 8291 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  winboxPort?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  webfigPort?: number;

  @ApiPropertyOptional({ example: 22 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;

  @ApiPropertyOptional({ example: "admin" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accessUsername?: string;

  @ApiPropertyOptional({ description: "Stored encrypted — AES-256-GCM" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  accessPassword?: string;
}
