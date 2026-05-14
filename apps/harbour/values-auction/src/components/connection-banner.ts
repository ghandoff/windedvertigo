import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ConnectionStatus, Transport } from '@/transport/transport';

/**
 * top-of-viewport banner that surfaces transport health. invisible while
 * 'connected'; renders an inline status pill when the WebSocket is
 * reconnecting or offline so participants and the facilitator know the
 * session isn't live in real time.
 *
 * the banner doesn't itself trigger reconnect — that lives in
 * SocketTransport. it only observes.
 */
@customElement('va-connection-banner')
export class VaConnectionBanner extends LitElement {
  @state() private status: ConnectionStatus = 'connected';
  private unsub?: () => void;
  private currentTransport?: Transport;

  /**
   * subscribe to a transport's status feed. safe to call repeatedly; the
   * previous subscription is torn down. pass `undefined` to detach.
   */
  attach(transport: Transport | undefined) {
    if (this.currentTransport === transport) return;
    this.unsub?.();
    this.unsub = undefined;
    this.currentTransport = transport;
    if (!transport) {
      this.status = 'connected';
      return;
    }
    this.unsub = transport.subscribeStatus((s) => {
      this.status = s;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
    this.unsub = undefined;
  }

  static styles = css`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 60;
      pointer-events: none;
      display: flex;
      justify-content: center;
      font-family: 'Atkinson Hyperlegible', system-ui, sans-serif;
    }
    .pill {
      pointer-events: auto;
      margin-top: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      font: var(--type-small);
      font-weight: 700;
      letter-spacing: 0.02em;
      box-shadow: var(--shadow-card);
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      max-width: calc(100vw - var(--space-5));
    }
    .pill.reconnecting {
      background: var(--wv-champagne);
      color: var(--wv-cadet);
    }
    .pill.offline {
      background: var(--wv-redwood);
      color: var(--wv-champagne);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    @media (prefers-reduced-motion: no-preference) {
      .pill.reconnecting .dot {
        animation: va-pulse 1.4s ease-in-out infinite;
      }
      @keyframes va-pulse {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
    }
  `;

  render() {
    if (this.status === 'connected') return html``;
    const label =
      this.status === 'reconnecting'
        ? 'reconnecting…'
        : 'offline — you may have lost your connection';
    return html`
      <span class="pill ${this.status}" role="status" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>
        ${label}
      </span>
    `;
  }
}
