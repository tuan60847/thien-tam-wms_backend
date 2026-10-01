import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

interface Store {
  req: Request;
}

interface RequestLike {
  id?: unknown;
  ip?: string;
  user?: { id?: string };
}

function current(): RequestLike | undefined {
  return storage.getStore()?.req as RequestLike | undefined;
}

const storage = new AsyncLocalStorage<Store>();

export const RequestContext = {
  requestId(): string | null {
    const id = current()?.id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
  },
  ip(): string | null {
    return current()?.ip ?? null;
  },
  userId(): string | null {
    return current()?.user?.id ?? null;
  },
};

// Makes the current request readable from anywhere (AuditService) without
// passing it through every call.
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    storage.run({ req }, next);
  }
}
