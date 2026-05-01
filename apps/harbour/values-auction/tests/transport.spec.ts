import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BroadcastTransport } from '@/transport/broadcast';
import type { TransportMessage } from '@/transport/transport';

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(public name: string) {
    let set = FakeBroadcastChannel.channels.get(name);
    if (!set) {
      set = new Set();
      FakeBroadcastChannel.channels.set(name, set);
    }
    set.add(this);
  }
  postMessage(data: unknown) {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const p of peers) {
      if (p !== this) {
        p.onmessage?.(new MessageEvent('message', { data }));
      }
    }
  }
  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

describe('BroadcastTransport', () => {
  beforeEach(() => {
    FakeBroadcastChannel.channels.clear();
    (globalThis as any).BroadcastChannel = FakeBroadcastChannel as any;
  });

  it('round-trips a message between two clients on the same session', async () => {
    const a = new BroadcastTransport('a');
    const b = new BroadcastTransport('b');
    await a.connect('S1', 'facilitator', 'a');
    await b.connect('S1', 'participant', 'b');

    const received = vi.fn();
    b.subscribe(received);

    const msg: TransportMessage = {
      type: 'action',
      payload: { type: 'ACT_ADVANCE' },
      at: 1,
      sender: 'a',
    };
    a.send(msg);

    await new Promise((r) => setTimeout(r, 0));

    expect(received).toHaveBeenCalledTimes(1);
    expect(received.mock.calls[0]?.[0]).toMatchObject({ type: 'action', sender: 'a' });
    a.disconnect();
    b.disconnect();
  });

  it('does not deliver messages back to sender', async () => {
    const a = new BroadcastTransport('a');
    await a.connect('S1', 'facilitator', 'a');
    const received = vi.fn();
    a.subscribe(received);
    a.send({ type: 'action', payload: {}, at: 1, sender: 'a' });
    await new Promise((r) => setTimeout(r, 0));
    expect(received).not.toHaveBeenCalled();
    a.disconnect();
  });

  it('unsubscribe removes listener', async () => {
    const a = new BroadcastTransport('a');
    const b = new BroadcastTransport('b');
    await a.connect('S1', 'facilitator', 'a');
    await b.connect('S1', 'participant', 'b');
    const received = vi.fn();
    const unsub = b.subscribe(received);
    unsub();
    a.send({ type: 'action', payload: {}, at: 1, sender: 'a' });
    await new Promise((r) => setTimeout(r, 0));
    expect(received).not.toHaveBeenCalled();
    a.disconnect();
    b.disconnect();
  });
});
