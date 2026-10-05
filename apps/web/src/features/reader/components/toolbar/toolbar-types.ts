import type { TranslationKeys } from '../../../../i18n';

/** Translation function shape shared by the toolbar and its overflow menu. */
export type TFn = (key: TranslationKeys, params?: Record<string, string | number>) => string;
