/**
 * Editorial assistance qualification gate (GOAP-999 Wave 4, AI-02; ADR-999 D5).
 *
 * Availability is *evidence-gated*, not configured: a category may only be
 * reported available once a qualification milestone has been met against the
 * ADR-999 §3 corpus. `local-engine` is met for spelling+grammar (GOAP-273 A3;
 * evidence in plans/273-goap-wave4-local-editorial-engines.md) and
 * `cloud-provider` ships UNMET — and a met milestone still reports
 * `engine_missing` unless `hasEngine()` confirms a present engine, so no UI or
 * endpoint claims more than the system can do.
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
 * Current state: `local-engine` is met for spelling+grammar (GOAP-273 A3,
 * evidence recorded below and in plans/273); `cloud-provider` stays unmet — no
 * vendor is selected by this work — and story/logic stay unqualified until the
 * B-track corpus run (GOAP-273 B2).
 *
 * WHAT A MET MILESTONE DOES: changes only the *reporting* inputs consumed
 * by `effectiveCategoryAvailability` — nothing dispatches, nothing infers.
 *
 * WHAT IT DOES NOT DO (all separate implementation work):
 *  - the workspace panel still wires only `plugins/local-editorial.ts`, which
 *    returns `engine_missing` with `hasEngine() === false`; the LanguageTool
 *    adapter (A2) is exported but not registered in the app;
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
    status: 'met',
    qualifiedAt: '2026-09-22',
    categories: ['spelling', 'grammar'],
    notes:
      'GOAP-273 A3: LanguageTool 6.9-SNAPSHOT (sha256-pinned, ADR-274 D3) passed ADR-999 §3 corpus items 1/2/4/6/7/8 — harness 6/6 and adapter live suite 6/6 (E2E_LIVE=1). en-US qualified (60 tags advertised; untested languages unclaimed). Host: Debian 11 x86_64 devcontainer, Temurin 17, deployment-local (no browser device); latency 49–287ms corpus / 74ms avg warm; RSS 878MB under traffic (heap -Xmx1g); download 251MB zip + 406MB unpacked + 136MB JRE; LGPL-2.1; loopback-only bind, zero non-loopback sockets observed. Full evidence: plans/273-goap-wave4-local-editorial-engines.md.',
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
