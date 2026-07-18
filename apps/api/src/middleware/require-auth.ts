import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/token.service.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const { sub } = verifyAccessToken(token);
    req.userId = sub;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
