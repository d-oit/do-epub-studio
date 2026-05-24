import { Hono } from 'hono';
import type { Env } from '../lib/env';

export const adminAuthRouter = new Hono<{ Bindings: Env }>();

// All auth logic moved to adminRouter to handle public/private split more easily
