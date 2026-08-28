/**
 * Shared i18n strings for E2E tests.
 *
 * WHY: Hard-coded translation strings in E2E tests drift when translations
 * change (e.g., du→Sie register fix in PR #853). This file centralizes
 * commonly asserted substrings so they're updated in one place.
 *
 * IMPORTANT: When changing a translation in apps/web/src/i18n/{locale}.ts,
 * update the corresponding value here. The Vitest snapshot test
 * (apps/web/src/__tests__/i18n-rendered-text.test.ts) will also catch
 * drift between catalog values and snapshots.
 */
export const I18N_E2E_STRINGS = {
  en: {
    loginSubtitle: 'Sign in to access your books',
    loginSubmit: 'Sign In',
    localeAriaLabel: /Select language/,
  },
  de: {
    loginSubtitle: 'Melde Sie sich an',
    loginSubmit: 'Anmelden',
    localeAriaLabel: /Sprache auswählen/,
  },
  fr: {
    loginSubtitle: 'Connectez-vous pour accéder à vos livres',
    loginSubmit: 'Se connecter',
    localeAriaLabel: /Sélectionner la langue/,
  },
  es: {
    loginSubtitle: 'Inicia sesión para acceder a tus libros',
    loginSubmit: 'Iniciar sesión',
    localeAriaLabel: /Seleccionar idioma/,
  },
  pt: {
    loginSubtitle: 'Entre para acessar seus livros',
    loginSubmit: 'Entrar',
    localeAriaLabel: /Selecionar idioma/,
  },
  it: {
    loginSubtitle: 'Accedi per visualizzare i tuoi libri',
    loginSubmit: 'Accedi',
    localeAriaLabel: /Seleziona lingua/,
  },
  ja: {
    loginSubtitle: 'ログインして本にアクセス',
    loginSubmit: 'ログイン',
    localeAriaLabel: /言語を選択/,
  },
  zh: {
    loginSubtitle: '登录以访问您的书籍',
    loginSubmit: '登录',
    localeAriaLabel: /选择语言/,
  },
  ko: {
    loginSubtitle: '로그인하여 책에 액세스',
    loginSubmit: '로그인',
    localeAriaLabel: /언어 선택/,
  },
  ar: {
    loginSubtitle: 'سجّل الدخول للوصول إلى كتبك',
    loginSubmit: 'تسجيل الدخول',
    localeAriaLabel: /اختر اللغة/,
  },
  ru: {
    loginSubtitle: 'Войдите, чтобы получить доступ к книгам',
    loginSubmit: 'Войти',
    localeAriaLabel: /Выберите язык/,
  },
  hi: {
    loginSubtitle: 'अपनी पुस्तकों तक पहुँचने के लिए लॉग इन करें',
    loginSubmit: 'लॉग इन',
    localeAriaLabel: /भाषा चुनें/,
  },
  nl: {
    loginSubtitle: 'Meld je aan om toegang te krijgen tot je boeken',
    loginSubmit: 'Inloggen',
    localeAriaLabel: /Selecteer taal/,
  },
} as const;

export type E2ELocale = keyof typeof I18N_E2E_STRINGS;
