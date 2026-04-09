import { type ZodSchema } from 'zod';

export function validateRequestBody<T>(schema: ZodSchema<T>, raw: unknown): { ok: true; data: T } | { ok: false; status: number; error: string; details: string[] } {
  const result = schema.safeParse(raw);
  
  if (!result.success) {
    const details = result.error.errors.map((err) => 
      `${err.path.join('.')}: ${err.message}`
    );
    return { ok: false, status: 400, error: 'Validation failed', details };
  }
  
  return { ok: true, data: result.data };
}

export function formatValidationErrors(errors: string[]): string {
  return errors.join('; ');
}
