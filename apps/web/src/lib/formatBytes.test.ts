import { afterEach, describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';
import { useLocaleStore } from '../stores/locale';

const MB = 1024 * 1024;

afterEach(() => {
  useLocaleStore.setState({ locale: 'en' });
});

describe('formatBytes (A10/GOAP-307)', () => {
  it('keeps the binary ladder and whole bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1.5 * MB)).toBe('1.5 MB');
    expect(formatBytes(100 * MB)).toBe('100.0 MB');
  });

  it('uses the selected UI locale for the decimal separator', () => {
    // The audit's acceptance: app locale de → the same magnitude reads "1,5 MB",
    // even though the browser locale stays en-US.
    useLocaleStore.setState({ locale: 'de' });
    expect(formatBytes(1.5 * MB)).toBe('1,5 MB');
    expect(formatBytes(100 * MB)).toBe('100,0 MB');

    useLocaleStore.setState({ locale: 'fr' });
    expect(formatBytes(1.5 * MB)).toBe('1,5 MB');
  });

  it('restores English formatting when the locale switches back', () => {
    useLocaleStore.setState({ locale: 'de' });
    expect(formatBytes(1.5 * MB)).toBe('1,5 MB');
    useLocaleStore.setState({ locale: 'en' });
    expect(formatBytes(1.5 * MB)).toBe('1.5 MB');
  });
});
