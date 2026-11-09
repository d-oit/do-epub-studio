import postcss, { type Declaration, type Rule } from 'postcss';

const ALLOWED_PROPERTIES: ReadonlySet<string> = new Set([
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-width',
  'border-color',
  'border-left',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-right',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-style',
  'border-top',
  'border-top-color',
  'border-top-style',
  'border-top-width',
  'border-width',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'list-style-type',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-width',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-indent',
  'vertical-align',
  'white-space',
  'word-spacing',
]);

function assertSafeDeclaration(declaration: Declaration): void {
  const property = declaration.prop.toLowerCase();
  const value = declaration.value.trim();
  if (!ALLOWED_PROPERTIES.has(property)) {
    throw new TypeError(`Stylesheet property is not allowed: ${declaration.prop}`);
  }
  if (
    value.length === 0 ||
    value.length > 512 ||
    value.includes('(') ||
    value.includes(')') ||
    value.includes('\\') ||
    value.includes('{') ||
    value.includes('}') ||
    value.includes('@')
  ) {
    throw new TypeError(`Stylesheet value is not allowed for ${declaration.prop}`);
  }
}

function assertSafeRule(rule: Rule): void {
  const selector = rule.selector.trim();
  if (
    selector.length === 0 ||
    selector.length > 1024 ||
    selector.includes('{') ||
    selector.includes('}')
  ) {
    throw new TypeError('Stylesheet selector is not allowed');
  }
}

/** Parses and normalizes author CSS; only passive, bounded presentation rules survive. */
export function sanitizeAuthorStylesheet(source: string): string {
  if (source.length === 0 || source.length > 64 * 1024) {
    throw new TypeError('Stylesheet must be between 1 byte and 64 KiB');
  }

  const root = postcss.parse(source, { from: undefined });
  root.walkComments((comment) => {
    comment.remove();
  });
  root.walkAtRules((rule) => {
    throw new TypeError(`Stylesheet at-rule is not allowed: @${rule.name}`);
  });
  root.walkRules(assertSafeRule);
  root.walkDecls(assertSafeDeclaration);

  return root.toString();
}
