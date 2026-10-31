import { describe, expect, it } from 'vitest';
import { getValidatedRunnerUrl } from '../lib/epub-validation-queue';

describe('getValidatedRunnerUrl', () => {
  it('restricts the request to the configured HTTP origin and validation path', () => {
    const endpoint = getValidatedRunnerUrl(
      'https://runner.example/custom/path?token=untrusted#fragment',
    );

    expect(endpoint.href).toBe('https://runner.example/validate');
  });

  it.each(['file:///etc/passwd', 'ftp://runner.example'])('rejects non-HTTP URLs: %s', (url) => {
    expect(() => getValidatedRunnerUrl(url)).toThrow('invalid_runner_url');
  });
});
