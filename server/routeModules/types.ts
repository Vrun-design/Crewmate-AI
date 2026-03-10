import type { Request, Response } from 'express';
import type { AuthUserRecord } from '../types';

export type RequireAuth = (req: Request, res: Response) => AuthUserRecord | null;
