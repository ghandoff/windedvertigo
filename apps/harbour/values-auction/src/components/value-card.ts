import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ValueCard } from '@/content/values';

@customElement('va-value-card')
export class VaValueCard extends LitElement {
  @property({ type: Object }) value?: ValueCard;
  @property({ type: String }) zone: 'must' | 'nice' | 'wont' | 'deck' = 'deck';
  @property({ type: Number }) ceiling = 0;
  @property({ type: Boolean, reflect: true }) large = false;
  @property({ type: Boolean, reflect: true }) focusable = false;

  static styles = css`
    :host {
      display: block;
    }
    .card {
      background: var(--bg-card);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      box-shadow: var(--shadow-card);
      border-left: 4px solid var(--wv-seafoam);
      transition:
        transform var(--dur-base) var(--ease-out-quart),
        box-shadow var(--dur-base) var(--ease-out-quart);
    }
    :host([large]) .card {
      padding: var(--space-6);
    }
    :host([large]) .name {
      font: var(--type-display);
    }
    :host([large]) .desc {
      font-size: 18px;
    }
    .card[data-zone='must'] {
      border-left-color: var(--accent-emphasis);
    }
    .card[data-zone='nice'] {
      border-left-color: var(--wv-burnt-sienna);
    }
    .card[data-zone='wont'] {
      border-left-color: rgba(39, 50, 72, 0.25);
      opacity: 0.6;
    }
    :host([focusable]) .card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-card-lifted);
    }
    :host([focusable]) .card:focus-visible {
      transform: translateY(-2px);
      box-shadow: var(--shadow-card-lifted);
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .name {
      font: var(--type-h2);
      margin-bottom: var(--space-2);
    }
    .desc {
      font: var(--type-small);
      color: var(--fg-muted);
    }
    .ceiling {
      margin-top: var(--space-3);
      font: var(--type-small);
      color: var(--fg-muted);
    }
  `;

  render() {
    if (!this.value) return html``;
    return html`
      <div
        class="card"
        data-zone=${this.zone}
        tabindex=${this.focusable ? '0' : '-1'}
        role=${this.focusable ? 'button' : 'article'}
        aria-label=${`${this.value.name}. ${this.value.description}`}
      >
        <div class="name">${this.value.name}</div>
        <div class="desc">${this.value.description}</div>
        ${this.ceiling > 0
          ? html`<div class="ceiling">soft ceiling: ${this.ceiling} credos</div>`
          : ''}
      </div>
    `;
  }
}
