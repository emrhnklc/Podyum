import type { PipeTransform } from "@nestjs/common";
import { ApiError } from "../../../common/errors/api-error.js";

export class EmptyGameBodyPipe implements PipeTransform {
  transform(value: unknown) {
    if (value === undefined || (value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)) return {};
    throw new ApiError(400, "VALIDATION_ERROR", "Bu işlem boş JSON gövdesi kabul eder.");
  }
}
