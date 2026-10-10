import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class FieldErrorDto {
  @ApiProperty()
  field!: string;
  @ApiProperty({ type: [String] })
  rules!: string[];
}

class ErrorDetailDto {
  @ApiProperty({ example: "VALIDATION_ERROR" })
  code!: string;
  @ApiProperty()
  message!: string;
  @ApiProperty({ format: "uuid" })
  requestId!: string;
  @ApiPropertyOptional({ type: [FieldErrorDto] })
  fields?: FieldErrorDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ErrorDetailDto })
  error!: ErrorDetailDto;
}
