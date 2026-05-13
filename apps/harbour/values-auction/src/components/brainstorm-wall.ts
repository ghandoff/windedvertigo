import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { COPY } from '@/content/copy';
import { BRAINSTORM_MAX_LEN } from '@/state/reducers';
import type { BrainstormResponse } from '@/state/types';

/**
 * the participant-side brainstorm wall: one text input, one submission,
 * then a live scroll of all anonymous responses across all 300 seats.
 *
 * a 0–3s random submission delay is added before dispatch to stagger
 * server load when many participants submit simultaneously (see spec).
 */
@customElement('va-brainstorm-wall')
export class VaBrainstormWall extends LitElement {
  @property({ type: Array }) responses: BrainstormResponse[] = [];
  @property({ type: Boolean }) submitted = false;
  @property({ type: Number }) total = 0;
  @property({ type: Number }) responded = 0;

  @state() private draft = '';
  @state() private pending = false;

  static styles = css`
    :host {
      display: block;
    }
    .frame {
      display: grid;
      gap: var(--space-5);
    }
    @media (min-width: 900px) {
      .frame {
        grid-template-columns: minmax(260px, 1fr) 2fr;
        align-items: start;
      }
    }
    .composer {
      background: var(--bg-card);
      padding: var(--space-5);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .composer h2 {
      font: var(--type-h1);
      margin: 0;
    }
    .composer .prompt {
      font: var(--type-h2);
      color: var(--wv-redwood);
      line-height: 1.3;
      margin: 0;
    }
    textarea {
      width: 100%;
      min-height: 90px;
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      border: 2px solid var(--wv-cadet-blue);
      font: var(--type-body);
      resize: none;
      box-sizing: border-box;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font: var(--type-small);
      color: var(--fg-muted);
    }
    button.submit {
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-pill);
      background: var(--wv-redwood);
      color: var(--fg-inverse);
      border: 0;
      font: var(--type-body);
      font-weight: 700;
      cursor: pointer;
    }
    button.submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .pending {
      font: var(--type-small);
      color: var(--fg-muted);
    }
    .submitted-note {
      padding: var(--space-3) var(--space-4);
      background: var(--bg);
      border-left: 3px solid var(--wv-redwood);
      color: var(--fg);
      border-radius: var(--radius-sm);
      font-weight: 700;
    }
    .feed {
      background: var(--bg-card);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-height: 70vh;
      overflow-y: auto;
    }
    .feed h3 {
      margin: 0;
      font: var(--type-h2);
    }
    .counter {
      font: var(--type-mono);
      color: var(--fg-muted);
      font-size: 14px;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .card {
      padding: var(--space-2) var(--space-3);
      background: var(--bg);
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--wv-cadet-blue);
      line-height: 1.4;
      animation: va-fade-in var(--dur-base) var(--ease-out-quart);
    }
    .empty {
      color: var(--fg-muted);
    }
  `;

  private submit() {
    if (this.submitted || this.pending) return;
    const text = this.draft.trim().slice(0, BRAINSTORM_MAX_LEN);
    if (!text) return;
    this.pending = true;
    // 0–3s random delay to stagger 300 simultaneous submissions.
    const delay = Math.floor(Math.random() * 3000);
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('va-brainstorm-submit', {
          detail: { text },
          bubbles: true,
          composed: true,
        }),
      );
      this.pending = false;
      this.draft = '';
    }, delay);
  }

  render() {
    const remaining = BRAINSTORM_MAX_LEN - this.draft.length;
    return html`
      <div class="frame">
        <section class="composer">
          <h2>${COPY.brainstorm.heading}</h2>
          <p class="prompt">${COPY.brainstorm.prompt}</p>
          ${this.submitted
            ? html`<p class="submitted-note">${COPY.brainstorm.submitted}</p>`
            : html`
                <textarea
                  maxlength=${BRAINSTORM_MAX_LEN}
                  placeholder=${COPY.brainstorm.placeholder}
                  .value=${this.draft}
                  ?disabled=${this.pending}
                  @input=${(e: Event) =>
                    (this.draft = (e.target as HTMLTextAreaElement).value)}
                ></textarea>
                <div class="meta">
                  <span>${remaining} chars left</span>
                  ${this.pending
                    ? html`<span class="pending">sending…</span>`
                    : html`<button
                        type="button"
                        class="submit"
                        ?disabled=${!this.draft.trim()}
                        @click=${() => this.submit()}
                      >
                        ${COPY.brainstorm.submit}
                      </button>`}
                </div>
              `}
        </section>
        <section class="feed" aria-live="polite">
          <div class="meta">
            <h3>${COPY.brainstorm.feedHeading}</h3>
            <span class="counter"
              >${COPY.brainstorm.counter(this.responded, this.total)}</span
            >
          </div>
          ${this.responses.length === 0
            ? html`<p class="empty">${COPY.brainstorm.feedEmpty}</p>`
            : html`
                <div class="cards">
                  ${[...this.responses]
                    .sort((a, b) => b.at - a.at)
                    .map((r) => html`<div class="card">${r.text}</div>`)}
                </div>
              `}
        </section>
      </div>
    `;
  }
}
