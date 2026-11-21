import {
  StepUpSchema,
  PasswordChangeSchema,
  MfaRegisterStartSchema,
  MfaRegisterVerifySchema,
  MfaAuthenticateVerifySchema,
  MfaRemoveSchema,
  RecoveryCodeRegenSchema,
  ApiActionSuccessEnvelopeSchema,
  AdminStepUpResponseSchema,
  AdminMfaOptionsResponseSchema,
} from '@do-epub-studio/schema';
import type { ApiContractEntry } from './types';

/**
 * Admin account / MFA / session contracts — issue #1489.
 */
export const adminAuthRoutes: ApiContractEntry[] = [
  {
    path: '/api/admin/account/mfa/status',
    method: 'GET',
    auth: 'admin',
    statusCodes: [200],
  },
  {
    path: '/api/admin/account/mfa/register-start',
    method: 'POST',
    auth: 'admin-step-up',
    statusCodes: [200],
    request: { body: MfaRegisterStartSchema },
    response: AdminMfaOptionsResponseSchema,
  },
  {
    path: '/api/admin/account/mfa/register-verify',
    method: 'POST',
    auth: 'admin-step-up',
    statusCodes: [200],
    request: { body: MfaRegisterVerifySchema },
  },
  {
    path: '/api/admin/account/mfa/authenticate-start',
    method: 'POST',
    auth: 'admin',
    statusCodes: [200],
    response: AdminMfaOptionsResponseSchema,
  },
  {
    path: '/api/admin/account/mfa/authenticate-verify',
    method: 'POST',
    auth: 'admin',
    statusCodes: [200],
    request: { body: MfaAuthenticateVerifySchema },
  },
  {
    path: '/api/admin/account/mfa/passkey/:id',
    method: 'DELETE',
    auth: 'admin-mfa',
    statusCodes: [200],
    request: { body: MfaRemoveSchema },
  },
  {
    path: '/api/admin/account/mfa/recovery-codes/regenerate',
    method: 'POST',
    auth: 'admin-mfa',
    statusCodes: [200],
    request: { body: RecoveryCodeRegenSchema },
  },
  {
    path: '/api/admin/account/sessions',
    method: 'GET',
    auth: 'admin',
    statusCodes: [200],
  },
  {
    path: '/api/admin/account/logout-all',
    method: 'POST',
    auth: 'admin',
    statusCodes: [200],
    response: ApiActionSuccessEnvelopeSchema,
  },
  {
    path: '/api/admin/account/step-up',
    method: 'POST',
    auth: 'admin',
    statusCodes: [200],
    request: { body: StepUpSchema },
    response: AdminStepUpResponseSchema,
  },
  {
    path: '/api/admin/account/password-change',
    method: 'POST',
    auth: 'admin',
    statusCodes: [200],
    request: { body: PasswordChangeSchema },
    response: ApiActionSuccessEnvelopeSchema,
  },
];
