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
    .compact-progress {
      display: none;
      font: var(--type-mono);
      font-size: 12px;
      color: var(--fg-muted);
      letter-spacing: 0.06em;
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
      background: var(--wv-seafoam);
      color: var(--fg-inverse);
    }
    @media (max-width: 639px) {
      /* participant (non-interactive): hide pill list, show compact text instead */
      ol.participant {
        display: none;
      }
      .compact-progress {
        display: block;
      }
      /* facilitator (interactive): single scrollable row */
      ol:not(.participant) {
        flex-wrap: nowrap;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        padding-bottom: var(--space-1);
        scrollbar-width: none;
      }
      ol:not(.participant)::-webkit-scrollbar {
        display: none;
      }
      li {
        flex-shrink: 0;
        scroll-snap-align: start;
      }
      button {
        padding: var(--space-1) var(--space-3);
        font-size: 11px;
      }
    }
  `;

  private currentIndex() {
    return ACTS.find((a) => a.id === this.currentAct)?.index ?? 0;
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('currentAct') && this.interactive) {
      const current = this.renderRoot.querySelector('[data-state="current"]') as HTMLElement | null;
      current?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  render() {
    const currentIdx = this.currentIndex();
    const currentAct = ACTS[currentIdx];
    return html`
      <div class="compact-progress" aria-hidden="true">
        step ${currentIdx + 1} of ${ACTS.length} · ${currentAct?.name ?? ''}
      </div>
      <ol aria-label="act timeline" class=${this.interactive ? '' : 'participant'}>
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
