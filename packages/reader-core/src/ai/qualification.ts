/**
 * Editorial assistance qualification gate (GOAP-999 Wave 4, AI-02; ADR-999 D5).
 *
 * Availability is *evidence-gated*, not configured: a category may only be
 * reported available once a qualification milestone has been met against the
 * ADR-999 §3 corpus. Both milestones ship UNMET, so every category reports
 * `engine_missing` and no UI or endpoint may claim otherwise.
 *
 * Flipping a milestone requires the recorded evidence named in ADR-999 D5 —
 * corpus results, supported languages/devices, latency, memory, model download
 * size and licence, and no-egress observations. That is a deliberate,
 * reviewable change; nothing in this module may infer it.
 */

import type { EditorialCategory, EditorialUnavailableReason } from './editorial-findings';

export type QualificationId = 'local-engine' | 'cloud-provider';

export interface QualificationMilestone {
  id: QualificationId;
  status: 'unmet' | 'met';
  /** ISO date the milestone was met, or null while unmet. */
  qualifiedAt: string | null;
  /**
   * Categories the milestone qualifies. MUST stay empty while `status` is
   * `unmet` — a milestone cannot qualify a category it has not measured.
   */
  categories: readonly EditorialCategory[];
  /** Why the milestone is unmet, or the evidence that met it. */
  notes: string;
}

/**
 * Shipped state: no local inference engine is bundled and no cloud provider has
 * been qualified (no vendor is selected by this work). Both entries stay unmet
 * until the documented evidence exists.
 */
export const QUALIFICATION_MILESTONES: readonly QualificationMilestone[] = [
  {
    id: 'local-engine',
    status: 'unmet',
    qualifiedAt: null,
    categories: [],
    notes:
      'No on-device engine is bundled. Meeting this requires the ADR-999 §3 corpus run on a real engine with recorded languages, devices, latency, memory, model size/licence and no-egress observations.',
  },
  {
    id: 'cloud-provider',
    status: 'unmet',
    qualifiedAt: null,
    categories: [],
    notes:
      'No cloud provider is selected or funded. Meeting this requires an allowlisted deployment provider whose retention/training terms were checked against its official documentation, plus the same corpus run as local.',
  },
];

/** Availability of one category, derived strictly from the milestones above. */
export function categoryAvailability(
  category: EditorialCategory,
): 'available' | EditorialUnavailableReason {
  const qualifying = QUALIFICATION_MILESTONES.filter(
    (milestone) => milestone.status === 'met' && milestone.categories.includes(category),
  );
  if (qualifying.length > 0) {
    return 'available';
  }
  // Local engine is the default path; cloud is an explicit alternate that can
  // never be reached implicitly, so an unqualified default reports the engine.
  return 'engine_missing';
}

/** True when at least one milestone claims the category — used by the UI badge. */
export function isCategoryAvailable(category: EditorialCategory): boolean {
  return categoryAvailability(category) === 'available';
}

/** Milestone lookup for the qualification report shown in the workspace. */
export function milestone(id: QualificationId): QualificationMilestone {
  const found = QUALIFICATION_MILESTONES.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Unknown qualification milestone: ${id}`);
  }
  return found;
}
