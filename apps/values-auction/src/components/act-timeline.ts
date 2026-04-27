import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ACTS } from '@/content/acts';
import type { ActId } from '@/state/types';

@customElement('va-act-timeline')
export class VaActTimeline extends LitElement {
  @property({ type: String }) currentAct: ActId = 'arrival';
  @property({ type: Boolean }) interactive = false;

  static styles = css`
    :host {
      display: block;
    }
    ol {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    li {
      list-style: none;
    }
    button {
      font: var(--type-small);
      font-weight: 700;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      background: rgba(39, 50, 72, 0.08);
      color: var(--fg);
      border: 2px solid transparent;
      cursor: pointer;
      transition:
        background var(--dur-base) var(--ease-in-out),
        color var(--dur-base) var(--ease-in-out);
    }
    button[data-state='current'] {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
    }
    button[data-state='done'] {
      opacity: 0.5;
    }
    button[data-state='future'] {
      opacity: 0.7;
    }
    button:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    button:not(:disabled):hover {
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
    }
  `;

  private currentIndex() {
    return ACTS.find((a) => a.id === this.currentAct)?.index ?? 0;
  }

  render() {
    const currentIdx = this.currentIndex();
    return html`
      <ol aria-label="act timeline">
        ${ACTS.map((act) => {
          const state =
            act.index < currentIdx ? 'done' : act.index === currentIdx ? 'current' : 'future';
          return html`<li>
            <button
              type="button"
              data-state=${state}
              ?disabled=${!this.interactive}
              aria-current=${state === 'current' ? 'step' : 'false'}
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('va-jump', { detail: { to: act.id }, bubbles: true }),
                )}
            >
              ${act.index}. ${act.name}
            </button>
          </li>`;
        })}
      </ol>
    `;
  }
}
