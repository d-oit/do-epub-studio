import { z } from 'zod';
import { GrantModeSchema } from './common';
import { PasswordSchema } from './password';

export const InvitationRoleSchema = z.enum(['reader', 'creator']);
export type InvitationRole = z.infer<typeof InvitationRoleSchema>;

export const InvitationStatusSchema = z.enum([
  'pending',
  'processing',
  'accepted',
  'revoked',
  'expired',
  'failed',
]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const InvitationDeliveryStatusSchema = z.enum([
  'pending',
  'sent',
  'manual_copy_required',
  'failed',
]);
export type InvitationDeliveryStatus = z.infer<typeof InvitationDeliveryStatusSchema>;

export const CreateBookInvitationSchema = z.object({
  bookId: z.string().uuid(),
  email: z.string().email().max(255),
  role: InvitationRoleSchema.default('reader'),
  mode: GrantModeSchema.default('private'),
  commentsAllowed: z.boolean().default(false),
  offlineAllowed: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export type CreateBookInvitation = z.infer<typeof CreateBookInvitationSchema>;

export const AcceptBookInvitationSchema = z
  .object({
    token: z.string().min(32).max(256),
    newPassword: PasswordSchema,
    newPasswordConfirm: PasswordSchema,
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: 'Passwords do not match',
    path: ['newPasswordConfirm'],
  });

export type AcceptBookInvitation = z.infer<typeof AcceptBookInvitationSchema>;

export const InvitationsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type InvitationsListQuery = z.infer<typeof InvitationsListQuerySchema>;
