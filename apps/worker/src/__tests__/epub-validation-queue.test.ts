import { describe, expect, it } from 'vitest';
import { getValidatedRunnerUrl } from '../lib/epub-validation-queue';

describe('getValidatedRunnerUrl', () => {
  it('restricts the request to the configured HTTP origin and validation path', () => {
    const endpoint = getValidatedRunnerUrl(
      'https://runner.example/custom/path?token=untrusted#fragment',
    );

    expect(endpoint.href).toBe('https://runner.example/validate');
  });

  it('allows loopback HTTP runner URLs for local development', () => {
    const localhost = getValidatedRunnerUrl('http://localhost:8080/some/path');
    const ip = getValidatedRunnerUrl('http://127.0.0.1:8080/some/path');

    expect(localhost.href).toBe('http://localhost:8080/validate');
    expect(ip.href).toBe('http://127.0.0.1:8080/validate');
  });

  it('allows custom allowed hosts when configured', () => {
    const endpoint = getValidatedRunnerUrl(
      'https://custom-runner.internal/path',
      'runner.example, custom-runner.internal',
    );

    expect(endpoint.href).toBe('https://custom-runner.internal/validate');
  });

  it.each([
    'file:///etc/passwd',
    'ftp://runner.example',
    'http://runner.example',
    'https://untrusted.attacker.com/validate',
    'https://169.254.169.254/latest/meta-data',
    'not-a-valid-url',
  ])('rejects non-allowlisted or insecure URLs: %s', (url) => {
    expect(() => getValidatedRunnerUrl(url)).toThrow('invalid_runner_url');
  });
});
