import { HttpException } from "@nestjs/common";

export interface FieldError {
  field: string;
  rules: string[];
}

export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string, fields?: FieldError[]) {
    super({ code, message, ...(fields ? { fields } : {}) }, status);
  }
}
