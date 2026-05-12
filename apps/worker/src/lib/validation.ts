import { type ZodType, type infer as ZodInfer } from 'zod';

export function validateRequestBody<T extends ZodType>(
  schema: T,
  raw: unknown,
): { ok: true; data: ZodInfer<T> } | { ok: false; status: number; error: string; details: string[] } {
  const result = schema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`);
    return { ok: false, status: 400, error: 'Validation failed', details };
  }

  return { ok: true, data: result.data };
}

export function formatValidationErrors(errors: string[]): string {
  return errors.join('; ');
}
