import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export type ApiErrorDetail = { path: string; reason: string };

export class ApiErrorException extends HttpException {
  constructor(
    status: number,
    public readonly code: ApiErrorCode,
    public readonly userMessage: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super({ error: { code, message: userMessage, details } }, status);
  }
}

function flattenValidationErrors(errors: ValidationError[]): ApiErrorDetail[] {
  const out: ApiErrorDetail[] = [];

  const visit = (err: ValidationError, prefix: string) => {
    const path = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) {
      for (const msg of Object.values(err.constraints)) {
        out.push({ path, reason: msg });
      }
    }
    if (err.children && err.children.length > 0) {
      for (const c of err.children) visit(c, path);
    }
  };

  for (const e of errors) visit(e, '');
  return out.map((d) => ({ path: d.path || '(root)', reason: d.reason }));
}

@Catch()
export class ApiErrorExceptionFilter implements ExceptionFilter {
  static validationException(errors: ValidationError[]) {
    return new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: flattenValidationErrors(errors),
      },
    });
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Our own typed error.
    if (exception instanceof ApiErrorException) {
      return res.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.userMessage,
          details: exception.details ?? [],
        },
      });
    }

    // Nest HttpException (includes BadRequestException from ValidationPipe).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;

      if (body?.error?.code && body?.error?.message && Array.isArray(body?.error?.details)) {
        return res.status(status).json(body);
      }

      // fallback: keep envelope stable
      const message =
        typeof body?.message === 'string'
          ? body.message
          : Array.isArray(body?.message)
            ? body.message.join('; ')
            : exception.message || 'Unexpected server error';

      return res.status(status).json({
        error: {
          code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'VALIDATION_ERROR',
          message,
          details: [],
        },
      });
    }

    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', details: [] },
    });
  }
}

