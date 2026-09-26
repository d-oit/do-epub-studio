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
 * Current state: `local-engine` is met for spelling+grammar (GOAP-273 A3) and
 * for story/logic (GOAP-273 B2, 2026-09-25) — each with its own recorded
 * evidence; `cloud-provider` stays unmet, as no vendor is selected by this work.
 *
 * B2's evidence is **not** equivalent to A3's and the difference is load-bearing
 * for any UI copy. A3 ran a loopback service beside the app; B2 runs a
 * generative model *in the browser tab*, on demand:
 *  - download: **1.79 GB** for the q4 quantisation (vs 251 MB zip + 136 MB JRE),
 *    fetched on first use and never precached;
 *  - memory: **3.55 GB peak RSS** measured in a Node harness (vs 878 MB for the
 *    LanguageTool service) — a browser tab must sustain this;
 *  - latency: **12.8 s** to load and **~13 s** per review on CPU. No WebGPU
 *    measurement exists (see the B2 note), so the interactive figure is unknown.
 * The category is qualified as *working*, not as *fast*: the on-demand download
 * must be visible and consented to, which is separate implementation work.
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
    id: 'local-engine',
    status: 'met',
    qualifiedAt: '2026-09-25',
    categories: ['story', 'logic'],
    notes:
      'GOAP-273 B2: onnx-community/Qwen2.5-1.5B-Instruct (Apache-2.0) via @huggingface/transformers 4.3.0, inference in the browser tab. ADR-999 §3 corpus items 3/5 4/4 PASS live, default config, do_sample:false (load 12.8s; item 3 13.6s; item 5 13.1s; n=1, CPU). English only — the prompt is English and no other language was measured. Download 1.79GB q4 (model_q4.onnx 1787566590B + 7MB tokenizer), on demand and never precached, verified absent from apps/web/dist and the SW precache manifest. Memory 3552MB peak RSS (89MB before load) in Node; a browser tab must sustain this. NOT WebGPU-measured: this devcontainer has no WebGPU, so interactive latency is unknown and every figure above is the slow CPU path. 0.5B was rejected — it paraphrases quotes and the trust boundary rejected every claim as incomplete_analysis. Full evidence: plans/273-goap-wave4-local-editorial-engines.md.',
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
    /**
     * Whether a usable engine is present **for this category**. Per-category,
     * not a single global flag: one adapter serving spelling+grammar says
     * nothing about story/logic, and a shared boolean would let a live
     * LanguageTool make an unrunnable generative category read as available.
     * A plain boolean is still accepted and means "for every category".
     */
    enginePresent: boolean | Partial<Record<EditorialCategory, boolean>>;
    milestones?: readonly QualificationMilestone[];
  },
): 'available' | EditorialUnavailableReason {
  const present =
    typeof options.enginePresent === 'boolean'
      ? options.enginePresent
      : (options.enginePresent[category] ?? false);
  if (!present) {
    return 'engine_missing';
  }
  return categoryAvailability(category, options.milestones ?? QUALIFICATION_MILESTONES);
}

/** True when the category may be presented as working — qualification AND engine. */
export function isCategoryAvailable(
  category: EditorialCategory,
  enginePresent: boolean | Partial<Record<EditorialCategory, boolean>>,
): boolean {
  return effectiveCategoryAvailability(category, { enginePresent }) === 'available';
}

/**
 * Milestone lookup for the qualification report shown in the workspace.
 *
 * `local-engine` has one entry **per qualification phase** (A3 spelling+grammar,
 * B2 story+logic), so a lookup by id merges them: callers asking what the local
 * engine may claim get every qualified category and both evidence notes, not
 * whichever entry happens to come first.
 */
export function milestone(id: QualificationId): QualificationMilestone {
  const found = QUALIFICATION_MILESTONES.filter((entry) => entry.id === id);
  const [first, ...rest] = found;
  if (!first) {
    throw new Error(`Unknown qualification milestone: ${id}`);
  }
  if (rest.length === 0) {
    return first;
  }
  return {
    ...first,
    qualifiedAt:
      first.qualifiedAt ?? rest.map((entry) => entry.qualifiedAt).find((at) => at !== null) ?? null,
    categories: [...new Set(found.flatMap((entry) => entry.categories))],
    notes: found.map((entry) => entry.notes).join(' '),
  };
}
