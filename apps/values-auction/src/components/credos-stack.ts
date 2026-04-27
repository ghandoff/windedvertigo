import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('va-chip')
export class VaChip extends LitElement {
  @property({ type: Number }) count = 150;
  @property({ type: String }) label = 'credos';
  @property({ type: String }) tone: 'paper' | 'deep' | 'urgent' = 'paper';

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      background: var(--bg-card);
      color: var(--fg);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      box-shadow: var(--shadow-card);
      font-weight: 700;
      min-width: 120px;
      justify-content: center;
      transition: transform var(--dur-base) var(--ease-spring);
    }
    :host([tone='deep']) {
      background: var(--bg-deep);
      color: var(--fg-inverse);
    }
    :host([tone='urgent']) {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
    }
    .count {
      font-variant-numeric: tabular-nums;
      font-size: 20px;
    }
    .label {
      font-weight: 400;
      font-size: 14px;
      opacity: 0.8;
    }
  `;

  render() {
    return html`
      <span class="count" aria-label=${`${this.count} ${this.label}`}>${this.count}</span>
      <span class="label">${this.label}</span>
    `;
  }
}
