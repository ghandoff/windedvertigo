import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { COPY } from '@/content/copy';
import './va-button';

@customElement('va-bid-button')
export class VaBidButton extends LitElement {
  @property({ type: Number }) currentHigh = 0;
  @property({ type: Number }) credos = 0;
  @property({ type: Boolean }) disabled = false;

  @state() private open = false;
  @state() private draft = 0;
  @state() private error = '';

  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
    }
    .input-row {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }
    input {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-pill);
      border: 2px solid var(--wv-cadet-blue);
      background: var(--bg-card);
      color: var(--fg);
      font: var(--type-body);
      font-weight: 700;
      width: 120px;
      text-align: center;
    }
    input:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .error {
      color: var(--wv-redwood);
      font: var(--type-small);
    }
  `;

  private openDraft() {
    this.open = true;
    this.draft = Math.max(this.currentHigh + 1, 1);
    this.error = '';
    queueMicrotask(() => {
      this.renderRoot.querySelector<HTMLInputElement>('input')?.focus();
    });
  }

  private confirm() {
    if (this.draft <= this.currentHigh) {
      this.error = COPY.auction.mustBeatHigh;
      return;
    }
    if (this.draft > this.credos) {
      this.error = COPY.auction.insufficientCredos;
      return;
    }
    this.dispatchEvent(
      new CustomEvent('va-bid', {
        detail: { amount: this.draft },
        bubbles: true,
        composed: true,
      }),
    );
    this.open = false;
  }

  render() {
    if (!this.open) {
      return html`
        <va-button
          variant="urgent"
          size="lg"
          ?disabled=${this.disabled}
          @va-click=${() => this.openDraft()}
        >
          ${COPY.auction.bidCta}
        </va-button>
      `;
    }
    return html`
      <div class="input-row">
        <label for="bid-amount" class="sr-only">${COPY.auction.nextBidLabel}</label>
        <input
          id="bid-amount"
          type="number"
          min=${this.currentHigh + 1}
          max=${this.credos}
          .value=${String(this.draft)}
          aria-label=${COPY.auction.nextBidLabel}
          @input=${(e: Event) => {
            this.draft = Number((e.target as HTMLInputElement).value);
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') this.confirm();
            if (e.key === 'Escape') this.open = false;
          }}
        />
        <va-button variant="urgent" size="md" @va-click=${() => this.confirm()}>
          ${COPY.auction.bidCta}
        </va-button>
      </div>
      ${this.error ? html`<div class="error" role="alert">${this.error}</div>` : ''}
    `;
  }
}
