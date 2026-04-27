import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('va-button')
export class VaButton extends LitElement {
  @property({ type: String, reflect: true }) variant: 'primary' | 'urgent' | 'ghost' | 'secondary' =
    'primary';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';

  static styles = css`
    :host {
      display: inline-block;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      font: var(--type-body);
      font-weight: 700;
      padding: var(--space-3) var(--space-5);
      background: var(--wv-cadet-blue);
      color: var(--wv-white);
      border-radius: var(--radius-pill);
      transition:
        transform var(--dur-fast) var(--ease-spring),
        background var(--dur-base) var(--ease-in-out),
        opacity var(--dur-base) var(--ease-in-out);
      min-height: 44px;
    }
    :host([variant='urgent']) button {
      background: var(--wv-redwood);
    }
    :host([variant='ghost']) button {
      background: transparent;
      color: var(--fg);
      border: 1.5px solid var(--fg);
    }
    :host([variant='secondary']) button {
      background: var(--bg-card);
      color: var(--fg);
      border: 1.5px solid rgba(26, 36, 56, 0.2);
    }
    button:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    button:active:not(:disabled) {
      transform: scale(0.97);
    }
    :host([disabled]) button {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none !important;
    }
    :host([size='lg']) button {
      font-size: 18px;
      padding: var(--space-4) var(--space-6);
      min-height: 56px;
    }
    :host([size='sm']) button {
      font-size: 14px;
      padding: var(--space-2) var(--space-4);
      min-height: 36px;
    }
    button:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
  `;

  render() {
    return html`
      <button
        ?disabled=${this.disabled}
        part="button"
        @click=${(e: Event) => {
          if (this.disabled) {
            e.stopPropagation();
            return;
          }
          this.dispatchEvent(new CustomEvent('va-click', { bubbles: true, composed: true }));
        }}
      >
        <slot></slot>
      </button>
    `;
  }
}
