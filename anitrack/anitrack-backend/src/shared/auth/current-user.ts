import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { TEMP_USER_ID } from './temp-user';

export interface CurrentUser {
  id: string;
}

type RequestWithUser = Request & {
  currentUser?: CurrentUser;
  user?: { id?: string } | { sub?: string } | undefined;
};

function resolveCurrentUser(req: RequestWithUser): CurrentUser {
  if (req.currentUser?.id) return req.currentUser;

  // Future auth compatibility: prefer a real user injected by auth layer.
  const anyUser = req.user as any;
  const id = (anyUser?.id ?? anyUser?.sub) as string | undefined;
  if (id) return { id };

  // Dev single-user fallback.
  return { id: TEMP_USER_ID };
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    return resolveCurrentUser(req);
  },
);
