import { describe, it, expect, beforeEach } from 'vitest';
import { useSwUpdateStore } from '../stores/sw-update';

describe('useSwUpdateStore', () => {
  beforeEach(() => {
    useSwUpdateStore.setState({
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: null,
    });
  });

  it('has correct initial state', () => {
    const state = useSwUpdateStore.getState();
    expect(state.needRefresh).toBe(false);
    expect(state.offlineReady).toBe(false);
    expect(state.updateServiceWorker).toBeNull();
  });

  it('setNeedRefresh sets needRefresh and stores update function', () => {
    const updateFn = vi.fn();
    useSwUpdateStore.getState().setNeedRefresh(updateFn);

    const state = useSwUpdateStore.getState();
    expect(state.needRefresh).toBe(true);
    expect(state.updateServiceWorker).toBe(updateFn);
  });

  it('setNeedRefresh clears needRefresh when called with null', () => {
    useSwUpdateStore.getState().setNeedRefresh(vi.fn());
    expect(useSwUpdateStore.getState().needRefresh).toBe(true);

    useSwUpdateStore.getState().setNeedRefresh(null);
    const state = useSwUpdateStore.getState();
    expect(state.needRefresh).toBe(false);
    expect(state.updateServiceWorker).toBeNull();
  });

  it('setOfflineReady sets offlineReady flag', () => {
    useSwUpdateStore.getState().setOfflineReady(true);
    expect(useSwUpdateStore.getState().offlineReady).toBe(true);

    useSwUpdateStore.getState().setOfflineReady(false);
    expect(useSwUpdateStore.getState().offlineReady).toBe(false);
  });

  it('dismiss resets all state to defaults', () => {
    const updateFn = vi.fn();
    useSwUpdateStore.getState().setNeedRefresh(updateFn);
    useSwUpdateStore.getState().setOfflineReady(true);

    useSwUpdateStore.getState().dismiss();

    const state = useSwUpdateStore.getState();
    expect(state.needRefresh).toBe(false);
    expect(state.offlineReady).toBe(false);
    expect(state.updateServiceWorker).toBeNull();
  });
});
