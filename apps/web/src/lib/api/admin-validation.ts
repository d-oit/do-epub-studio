import { apiRequest } from './core';

export interface RevisionReportSummary {
  revisionId: string;
  bytesSha256: string | null;
  validatorVersion: string;
  status: string;
  safetyStatus: string;
  epubVersion: string | null;
  updatedAt: string;
}

export interface EpubFindingItem {
  severity: 'error' | 'warning' | 'info';
  code: string;
  location: string | null;
  path: string | null;
  message: string;
}

export interface FindingGroups {
  errors: EpubFindingItem[];
  warnings: EpubFindingItem[];
  information: EpubFindingItem[];
}

export interface AccessibilityMetadataItem {
  key: string;
  value?: string;
  present?: boolean;
  provenance: string;
}

export interface AccessibilityAdvisory {
  category: string;
  message: string;
  source: string;
}

export interface AccessibilityEvidence {
  metadata: AccessibilityMetadataItem[];
  advisories: AccessibilityAdvisory[];
  manualReviewRequired: boolean;
  certification: string;
}

export interface AccessibilityRemediationState {
  status?: 'not_started' | 'in_progress' | 'remediated' | 'accepted_risk';
  notes?: string | null;
  checklist?: Record<string, boolean>;
}

export interface RevisionValidationDetail {
  revisionId: string;
  bytesSha256: string | null;
  validatorVersion: string;
  status: string;
  safetyStatus: string;
  epubVersion: string | null;
  groups: FindingGroups;
  accessibility: AccessibilityEvidence;
  remediation: AccessibilityRemediationState;
  failureCode: string | null;
  updatedAt: string;
}

export async function fetchRevisionReports(
  bookId: string,
  token?: string,
): Promise<RevisionReportSummary[]> {
  return apiRequest<RevisionReportSummary[]>(
    `/api/admin/books/${encodeURIComponent(bookId)}/validation-reports`,
    {
      token,
    },
  );
}

export async function fetchRevisionValidationDetail(
  bookId: string,
  revisionId: string,
  token?: string,
): Promise<RevisionValidationDetail> {
  return apiRequest<RevisionValidationDetail>(
    `/api/admin/books/${encodeURIComponent(bookId)}/revisions/${encodeURIComponent(revisionId)}/validation`,
    { token },
  );
}

export async function retryRevisionValidation(
  bookId: string,
  revisionId: string,
  token?: string,
): Promise<void> {
  await apiRequest(
    `/api/admin/books/${encodeURIComponent(bookId)}/revisions/${encodeURIComponent(revisionId)}/validation/retry`,
    {
      method: 'POST',
      token,
    },
  );
}

export async function updateRevisionRemediation(
  bookId: string,
  revisionId: string,
  remediation: AccessibilityRemediationState,
  token?: string,
): Promise<{ revisionId: string; remediation: AccessibilityRemediationState; updatedAt: string }> {
  return apiRequest(
    `/api/admin/books/${encodeURIComponent(bookId)}/revisions/${encodeURIComponent(revisionId)}/accessibility-remediation`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(remediation),
    },
  );
}
