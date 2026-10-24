import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { InstalledGuest } from '@/lib/guests/types';
import type { GuestOauthStatus } from '@/lib/guests/oauth';
import { useGuestOauthStore } from '@/lib/guests/oauth-store';

/** A connection missing the account name the contract requires. */
type ConnectionWithoutAccount = { connected: boolean; account?: string };

describe('GuestIntegrationCard', () => {
  let dom: Window;
  let root: Root | undefined;
  let container: HTMLElement;
  const globals = new Map<string, PropertyDescriptor | undefined>();

  const guest: InstalledGuest = {
    id: 'demo',
    name: 'Demo',
    icon: 'apps',
    capabilities: { requested: [], granted: [] },
    source: 'bundled',
    integration: { name: 'Demo', description: 'Demo integration', auth: 'token' },
  };

  const connectedWithoutAccount = (): GuestOauthStatus => {
    const connection = { connected: true, account: 'ada' };
    // SAFETY: simulates a server that answered without an account name; the card must fall back instead of crashing.
    delete (connection as ConnectionWithoutAccount).account;
    return { connection, settings: {}, hasClient: false, redirectUri: '' };
  };

  beforeEach(() => {
    dom = new Window({ url: 'http://localhost/' });
    const values = {
      window: dom, document: dom.document, navigator: dom.navigator,
      HTMLElement: dom.HTMLElement, Element: dom.Element, Node: dom.Node,
      HTMLInputElement: dom.HTMLInputElement, DocumentFragment: dom.DocumentFragment,
      MutationObserver: dom.MutationObserver, ResizeObserver: dom.ResizeObserver,
      MouseEvent: dom.MouseEvent, PointerEvent: dom.PointerEvent, Event: dom.Event,
      CustomEvent: dom.CustomEvent, getComputedStyle: dom.getComputedStyle.bind(dom),
      requestAnimationFrame: dom.requestAnimationFrame.bind(dom),
      cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom), IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const [key, value] of Object.entries(values)) {
      globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    Object.defineProperty(window, '__OPENCHAMBER_API_BASE_URL__', { configurable: true, value: 'https://runtime-a.example' });
    useGuestOauthStore.getState().resetForRuntimeSwitch();
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(async () => {
    if (root) await act(async () => { root?.unmount(); });
    root = undefined;
    useGuestOauthStore.getState().resetForRuntimeSwitch();
    await dom.happyDOM.close();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    globals.clear();
  });

  test('falls back to Connected when the connection arrives without an account name', async () => {
    useGuestOauthStore.getState().setStatus('demo', connectedWithoutAccount());
    const { createRoot } = await import('react-dom/client');
    const { GuestIntegrationCard } = await import('./GuestIntegrationsSection');
    const { I18nProvider } = await import('@/lib/i18n');
    const mounted = createRoot(container);
    root = mounted;
    await act(async () => {
      mounted.render(<I18nProvider><GuestIntegrationCard guest={guest} /></I18nProvider>);
    });

    expect(container.textContent).not.toContain('ada');
    expect(container.textContent).toContain('Connected');
  });
});
