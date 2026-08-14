import type { Hono, Context } from 'hono';
import type { Env } from '../../../lib/env';
import type { RequestContext } from '../../../lib/observability';

export type AuthApp = Hono<{
  Bindings: Env;
  Variables: { requestContext: RequestContext; adminUser: { email: string; id: string; role: string } };
}>;

/**
 * Context type for extracted top-level route handlers. Hono infers the precise
 * per-route context (middleware variables + zValidator Input) from the
 * `router.*(...)` call, so a concrete route handler is declared against a
 * representative env (only the variables these handlers inject) and a loose
 * `json` input. The request body is runtime-validated by zValidator + Zod
 * before the handler runs, so loosening the input shape here doesn't weaken
 * validation and keeps extracted handlers typecheckable without tying each to
 * one schema.
 */
export type RouteContext = Context<
  { Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } },
  string,
  /* Intentional: loose input body; runtime-validated by zValidator + Zod. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { in: { json: any }; out: { json: any } }
>;
