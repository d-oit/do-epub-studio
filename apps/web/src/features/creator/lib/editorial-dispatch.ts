// editorial-dispatch.ts — category-owning engine routing + outcome merge.
//
// F1 (GOAP-290) / GOAP-293: each category is served by exactly one adapter —
// spelling/grammar by the LanguageTool plugin, story/logic by the
// Transformers.js plugin — so the panel runs every engine that owns a
// requested category and merges what the seam returns. The merge never hides
// a gap: an engine that is missing makes its categories read as
// `engine_missing`, an unfinished engine run is reported with its own reason,
// and `no_supported_findings` is only returned when every requested category
// was actually reviewed.

import type {
  AiPlugin,
  EditorialCategory,
  EditorialFinding,
  EditorialReviewOutcome,
  EditorialReviewRequest,
} from '@do-epub-studio/reader-core';

export interface EditorialEngine {
  categories: readonly EditorialCategory[];
  plugin: Pick<AiPlugin, 'capabilities'>;
}

export type EditorialReviewInput = Pick<
  EditorialReviewRequest,
  'categories' | 'chapterText' | 'chapterSha256' | 'references' | 'styleRevision' | 'language'
> & {
  approvedTerms?: readonly string[];
};

export interface EditorialDispatchResult {
  outcome: EditorialReviewOutcome;
  enginesRun: number;
  missingCategories: EditorialCategory[];
}

type UnavailableOutcome = Extract<EditorialReviewOutcome, { status: 'unavailable' }>;

export async function dispatchEditorialReview(
  engines: readonly EditorialEngine[],
  input: EditorialReviewInput,
): Promise<EditorialDispatchResult> {
  const missingCategories: EditorialCategory[] = [];
  const findings: EditorialFinding[] = [];
  let cleanRuns = 0;
  let enginesRun = 0;
  let failure: UnavailableOutcome | null = null;

  for (const engine of engines) {
    const categories = engine.categories.filter((category) => input.categories.includes(category));
    if (categories.length === 0) continue;
    const capability = engine.plugin.capabilities.editorial;
    if (!capability || !capability.hasEngine()) {
      missingCategories.push(...categories);
      continue;
    }
    enginesRun += 1;
    const outcome = await capability.review({
      categories,
      chapterText: input.chapterText,
      chapterSha256: input.chapterSha256,
      references: input.references,
      styleRevision: input.styleRevision,
      language: input.language,
      approvedTerms: input.approvedTerms,
    });
    if (outcome.status === 'ok') {
      findings.push(...outcome.findings);
    } else if (outcome.status === 'no_supported_findings') {
      cleanRuns += 1;
    } else if (outcome.reason !== 'engine_missing' && failure === null) {
      failure = outcome;
    }
  }

  if (findings.length > 0) {
    return { outcome: { status: 'ok', findings }, enginesRun, missingCategories };
  }
  if (failure) {
    return { outcome: failure, enginesRun, missingCategories };
  }
  if (missingCategories.length > 0 || cleanRuns === 0) {
    return {
      outcome: { status: 'unavailable', reason: 'engine_missing' },
      enginesRun,
      missingCategories,
    };
  }
  return { outcome: { status: 'no_supported_findings' }, enginesRun, missingCategories };
}
