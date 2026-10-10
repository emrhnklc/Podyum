import { ValidationPipe } from "@nestjs/common";
import type { ValidationError } from "class-validator";
import { ApiError, type FieldError } from "../errors/api-error.js";

function fields(errors: ValidationError[], parent = ""): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...(error.constraints ? [{ field, rules: Object.keys(error.constraints) }] : []),
      ...fields(error.children ?? [], field),
    ];
  });
}

export function validationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new ApiError(400, "VALIDATION_ERROR", "İstek alanlarını kontrol et.", fields(errors)),
  });
}
