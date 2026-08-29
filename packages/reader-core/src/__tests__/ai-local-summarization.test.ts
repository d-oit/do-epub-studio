import { beforeEach, describe, expect, it } from 'vitest';

import {
  AiNotEnabledError,
  AiProviderUnavailableError,
  configureAiConsentStorage,
  createLocalSummarizationPlugin,
  setAiEnabled,
  type AiPlugin,
  type AiSummarizationResult,
  type AiSummarizeOptions,
} from '../ai';

const TEXT = 'The quick brown fox jumps over the lazy dog. '.repeat(20);

const engineCalls: Array<{ text: string; options?: AiSummarizeOptions }> = [];

/** A stand-in on-device engine capturing its calls. */
function fakeEngine(summaryText: string) {
  return {
    summarize: (text: string, options?: AiSummarizeOptions) => {
      engineCalls.push({ text, options });
      return Promise.resolve(summaryText);
    },
  };
}

async function summarizeText(
  plugin: AiPlugin,
  input: string,
  options?: AiSummarizeOptions,
): Promise<AiSummarizationResult> {
  const text = plugin.capabilities.text;
  if (!text) {
    throw new Error('test setup: text capability missing');
  }
  return text.summarize(input, options);
}

describe('local-summarization plugin', () => {
  beforeEach(() => {
    engineCalls.length = 0;
    const data = new Map<string, string>();
    configureAiConsentStorage({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
      },
    });
    setAiEnabled(false);
  });

  it('exposes the plugin contract (id/title/version/capabilities)', () => {
    const plugin = createLocalSummarizationPlugin();
    expect(plugin.id).toBe('local-summarization');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.capabilities.text?.kind).toBe('text');
    expect(plugin.capabilities.image).toBeUndefined();
    expect(plugin.capabilities.audio).toBeUndefined();
  });

  it('refuses to summarize before the user opts in', async () => {
    const plugin = createLocalSummarizationPlugin({ engine: fakeEngine('s') });
    await expect(summarizeText(plugin, TEXT)).rejects.toThrowError(AiNotEnabledError);
    expect(engineCalls).toHaveLength(0);
  });

  it('fails closed when no inference engine is registered', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin();
    await expect(summarizeText(plugin, TEXT)).rejects.toThrowError(AiProviderUnavailableError);
  });

  it('reports the missing-engine reason for the engine-less plugin', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin({});
    await expect(summarizeText(plugin, TEXT)).rejects.toThrowError(
      /no on-device inference engine/,
    );
  });

  it('returns engine output with plugin metadata', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin({ engine: fakeEngine('A short summary.') });
    const result = await summarizeText(plugin, TEXT);
    expect(result.summary).toBe('A short summary.');
    expect(result.pluginId).toBe('local-summarization');
    expect(result.model).toBe('on-device');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes trimmed input and options through to the engine', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin({ engine: fakeEngine('s') });
    await summarizeText(plugin, TEXT, { maxWordCount: 12 });
    expect(engineCalls).toHaveLength(1);
    expect(engineCalls[0]).toEqual({ text: TEXT.trim(), options: { maxWordCount: 12 } });
  });

  it('rejects empty input without calling the engine', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin({ engine: fakeEngine('s') });
    await expect(summarizeText(plugin, '   ')).rejects.toThrowError(AiProviderUnavailableError);
    expect(engineCalls).toHaveLength(0);
  });

  it('wraps an empty engine output in AiProviderUnavailableError', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin({ engine: fakeEngine('   ') });
    await expect(summarizeText(plugin, TEXT)).rejects.toThrowError(AiProviderUnavailableError);
  });

  it('propagates engine failures unchanged', async () => {
    setAiEnabled(true);
    const plugin = createLocalSummarizationPlugin({
      engine: {
        summarize: () => Promise.reject(new Error('engine exploded')),
      },
    });
    await expect(summarizeText(plugin, TEXT)).rejects.toThrowError('engine exploded');
  });
});
