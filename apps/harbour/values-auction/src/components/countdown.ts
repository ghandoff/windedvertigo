import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { startTicker, formatMs, type TickHandle } from '@/utils/timer';
import { announce } from '@/utils/a11y';

@customElement('va-countdown')
export class VaCountdown extends LitElement {
  @property({ type: Number }) startedAt = 0;
  @property({ type: Number }) durationMs = 0;
  @property({ type: Boolean }) ring = false;
  @property({ type: Boolean }) announceSeconds = false;
  @property({ type: Boolean }) large = false;
  /**
   * if set, the timer freezes at this moment. used to honour facilitator
   * pause without losing the player's place. when the timer resumes,
   * durationMs is extended upstream so visible remaining stays stable.
   */
  @property({ type: Number }) pausedAt = 0;

  @state() private now = Date.now();
  private tick: TickHandle | null = null;
  private lastAnnounced = 0;

  connectedCallback() {
    super.connectedCallback();
    this.tick = startTicker((n) => {
      this.now = n;
      if (this.announceSeconds) {
        const remainingMs = Math.max(0, this.durationMs - (n - this.startedAt));
        const s = Math.ceil(remainingMs / 1000);
        if ([10, 5, 3, 2, 1].includes(s) && s !== this.lastAnnounced) {
          this.lastAnnounced = s;
          announce(`${s} seconds.`, 'assertive');
        }
      }
    }, 200);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.tick?.stop();
  }

  static styles = css`
    :host {
      display: inline-block;
      font-variant-numeric: tabular-nums;
    }
    .label {
      font: var(--type-mono);
      font-weight: 700;
      color: var(--fg);
    }
    :host([large]) .label {
      font-size: 48px;
      letter-spacing: 0.04em;
    }
    .ring-wrap {
      position: relative;
      width: 200px;
      height: 200px;
    }
    .ring {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .ring-track,
    .ring-fill {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
    }
    .ring-track {
      stroke: rgba(39, 50, 72, 0.12);
    }
    .ring-fill {
      stroke: var(--wv-cadet-blue);
      transition: stroke var(--dur-base) var(--ease-in-out);
    }
    :host([data-urgent]) .ring-fill {
      stroke: var(--wv-redwood);
    }
    .ring-wrap .label {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
    :host([data-urgent]) {
      color: var(--wv-redwood);
    }
  `;

  private remainingMs() {
    if (!this.startedAt) return this.durationMs;
    const reference = this.pausedAt > 0 ? this.pausedAt : this.now;
    return Math.max(0, this.durationMs - (reference - this.startedAt));
  }

  render() {
    const remaining = this.remainingMs();
    const urgent = remaining <= 10_000 && remaining > 0;
    if (urgent) this.setAttribute('data-urgent', '');
    else this.removeAttribute('data-urgent');

    const paused = this.pausedAt > 0;
    const ariaSuffix = paused ? ', paused' : '';

    if (!this.ring) {
      return html`<span
        class="label"
        role="timer"
        aria-live="off"
        aria-label=${`${formatMs(remaining)}${ariaSuffix}`}
        >${formatMs(remaining)}${paused ? ' · paused' : ''}</span
      >`;
    }

    const ratio = this.durationMs > 0 ? remaining / this.durationMs : 0;
    const circumference = 2 * Math.PI * 92;
    const offset = circumference * (1 - ratio);
    return html`
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
          <circle class="ring-track" cx="100" cy="100" r="92"></circle>
          <circle
            class="ring-fill"
            cx="100"
            cy="100"
            r="92"
            stroke-dasharray=${circumference}
            stroke-dashoffset=${offset}
          ></circle>
        </svg>
        <span
          class="label"
          role="timer"
          aria-label=${`${formatMs(remaining)}${ariaSuffix}`}
          >${formatMs(remaining)}${paused ? ' · paused' : ''}</span
        >
      </div>
    `;
  }
}
