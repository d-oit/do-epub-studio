import type { z } from 'zod';
import type {
  AnnotationLocatorSchema,
  LoginSchema,
  ValidateQuerySchema,
  SignedUrlSchema,
  UploadCompleteSchema,
} from './schemas';

export type AnnotationLocator = z.infer<typeof AnnotationLocatorSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type ValidateQuery = z.infer<typeof ValidateQuerySchema>;
export type SignedUrl = z.infer<typeof SignedUrlSchema>;
export type UploadComplete = z.infer<typeof UploadCompleteSchema>;
