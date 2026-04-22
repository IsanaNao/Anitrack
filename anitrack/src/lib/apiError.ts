import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "INTERNAL_ERROR";

export type ApiErrorDetail = { path: string; reason: string };

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetail[],
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? [],
      },
    },
    { status },
  );
}

