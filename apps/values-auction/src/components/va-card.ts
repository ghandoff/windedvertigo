import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('va-card')
export class VaCard extends LitElement {
  @property({ type: Boolean, reflect: true }) interactive = false;
  @property({ type: String }) tone: 'paper' | 'deep' | 'warm' = 'paper';

  static styles = css`
    :host {
      display: block;
      background: var(--bg-card);
      color: var(--fg);
      border-radius: var(--radius-md);
      padding: var(--space-5);
      box-shadow: var(--shadow-card);
      transition:
        transform var(--dur-base) var(--ease-out-quart),
        box-shadow var(--dur-base) var(--ease-out-quart);
    }
    :host([tone='deep']) {
      background: var(--bg-deep);
      color: var(--fg-inverse);
    }
    :host([tone='warm']) {
      background: var(--accent-warm);
      color: var(--fg-inverse);
    }
    :host([interactive]:hover),
    :host([interactive]:focus-within) {
      transform: translateY(-2px);
      box-shadow: var(--shadow-card-lifted);
    }
    :host([data-active]) {
      border: 3px solid var(--wv-redwood, currentColor);
      transform: translateY(-2px);
      box-shadow: var(--shadow-card-lifted);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}
