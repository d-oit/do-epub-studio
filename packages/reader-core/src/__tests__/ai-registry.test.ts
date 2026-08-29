import { beforeEach, describe, expect, it } from 'vitest';

import {
  AiPluginNotFoundError,
  AiPluginRegistrationError,
  getAiPlugin,
  listAiPlugins,
  registerAiPlugin,
  resetAiPluginRegistry,
  unregisterAiPlugin,
} from '../ai';
import type { AiPlugin } from '../ai';

function makePlugin(id: string, title = `Plugin ${id}`): AiPlugin {
  return { id, title, version: '1.0.0', capabilities: {} };
}

describe('AI plugin registry', () => {
  beforeEach(() => {
    resetAiPluginRegistry();
  });

  it('registers and looks up a plugin', () => {
    const plugin = makePlugin('p1');
    registerAiPlugin(plugin);
    expect(getAiPlugin('p1')).toBe(plugin);
  });

  it('throws AiPluginNotFoundError for an unknown id', () => {
    expect(() => getAiPlugin('missing')).toThrowError(AiPluginNotFoundError);
    expect(() => getAiPlugin('missing')).toThrowError('AI plugin "missing" is not registered');
  });

  it('throws AiPluginRegistrationError on duplicate id', () => {
    registerAiPlugin(makePlugin('dup'));
    expect(() => registerAiPlugin(makePlugin('dup'))).toThrowError(AiPluginRegistrationError);
  });

  it('lists plugins in registration order', () => {
    const a = makePlugin('a');
    const b = makePlugin('b');
    registerAiPlugin(a);
    registerAiPlugin(b);
    expect(listAiPlugins()).toEqual([a, b]);
  });

  it('unregisters a known plugin and returns true', () => {
    registerAiPlugin(makePlugin('x'));
    expect(unregisterAiPlugin('x')).toBe(true);
    expect(listAiPlugins()).toHaveLength(0);
    expect(() => getAiPlugin('x')).toThrowError(AiPluginNotFoundError);
  });

  it('returns false when unregistering an unknown plugin', () => {
    expect(unregisterAiPlugin('ghost')).toBe(false);
  });

  it('exposes capability interfaces on the plugin contract', () => {
    const plugin: AiPlugin = {
      id: 'cap',
      title: 'Cap',
      version: '1.0.0',
      capabilities: {
        text: {
          kind: 'text',
          summarize: () => Promise.resolve({ summary: 's', pluginId: 'cap', model: 'm', durationMs: 1 }),
        },
      },
    };
    registerAiPlugin(plugin);
    expect(getAiPlugin('cap').capabilities.text?.kind).toBe('text');
  });
});
