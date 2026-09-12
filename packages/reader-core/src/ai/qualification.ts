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
 *
 * WHAT FLIPPING A MILESTONE DOES: changes only the *reporting* inputs consumed
 * by `effectiveCategoryAvailability` — nothing dispatches, nothing infers.
 *
 * WHAT IT DOES NOT DO (all separate implementation work):
 *  - `plugins/local-editorial.ts` still returns `engine_missing` and
 *    `hasEngine() === false` until a real engine implements the `editorial`
 *    capability seam;
 *  - `POST /api/creator/books/:bookId/assistance/dispatch` still answers 501
 *    until a provider, its allowlist entry and the per-dispatch confirmation
 *    flow exist server-side.
 *
 * Because availability requires `hasEngine()` as well, a premature flip cannot
 * make the product claim a capability it does not have.
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
  milestones: readonly QualificationMilestone[] = QUALIFICATION_MILESTONES,
): 'available' | EditorialUnavailableReason {
  const qualifying = milestones.filter(
    (milestone) => milestone.status === 'met' && milestone.categories.includes(category),
  );
  if (qualifying.length > 0) {
    return 'available';
  }
  // Local engine is the default path; cloud is an explicit alternate that can
  // never be reached implicitly, so an unqualified default reports the engine.
  return 'engine_missing';
}

/**
 * What the product may actually claim right now.
 *
 * Qualification records that a category was *measured* to work; `enginePresent`
 * records that something can run at all. Both are required, because reporting a
 * category as available on the strength of a milestone while no engine is wired
 * would be exactly the false capability claim ADR-999 D4/D5 forbids. A milestone
 * flip alone therefore changes reporting inputs, not reality.
 */
export function effectiveCategoryAvailability(
  category: EditorialCategory,
  options: {
    enginePresent: boolean;
    milestones?: readonly QualificationMilestone[];
  },
): 'available' | EditorialUnavailableReason {
  if (!options.enginePresent) {
    return 'engine_missing';
  }
  return categoryAvailability(category, options.milestones ?? QUALIFICATION_MILESTONES);
}

/** True when the category may be presented as working — qualification AND engine. */
export function isCategoryAvailable(
  category: EditorialCategory,
  enginePresent: boolean,
): boolean {
  return effectiveCategoryAvailability(category, { enginePresent }) === 'available';
}

/** Milestone lookup for the qualification report shown in the workspace. */
export function milestone(id: QualificationId): QualificationMilestone {
  const found = QUALIFICATION_MILESTONES.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Unknown qualification milestone: ${id}`);
  }
  return found;
}
