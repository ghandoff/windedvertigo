import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { COPY } from '@/content/copy';
import { STARTING_CREDOS } from '@/state/reducers';
import { pollTally } from '@/state/selectors';
import type { Team } from '@/state/types';

/**
 * embedded team poll for a single value, used during team strategy and
 * restrategize. each participant types a suggested bid amount. the captain
 * sees all suggestions and locks a final number.
 *
 * emits `va-poll-vote` with the typed amount and `va-bid-lock` / `va-bid-unlock`
 * when the captain locks or unlocks the bid.
 */
@customElement('va-poll-buttons')
export class VaPollButtons extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: String }) valueId = '';
  @property({ type: String }) participantId = '';
  @property({ type: Boolean }) captain = false;

  @state() private draft = '';
  @state() private lockDraft = '';

  static styles = css`
    :host {
      display: block;
      margin-top: var(--space-3);
      padding: var(--space-3);
      background: var(--bg);
      border-radius: var(--radius-sm);
      border-top: 1px solid rgba(39, 50, 72, 0.1);
    }
    .prompt {
      font: var(--type-small);
      color: var(--fg-muted);
      margin-bottom: var(--space-2);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .input-row {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }
    input[type='number'] {
      width: 96px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: 2px solid var(--wv-seafoam);
      background: var(--bg-card);
      color: var(--fg);
      font: var(--type-body);
      font-variant-numeric: tabular-nums;
      -moz-appearance: textfield;
    }
    input[type='number']::-webkit-inner-spin-button,
    input[type='number']::-webkit-outer-spin-button {
      -webkit-appearance: none;
    }
    input[type='number']:focus {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .unit {
      font: var(--type-small);
      color: var(--fg-muted);
    }
    .suggestions {
      margin-top: var(--space-2);
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
    }
    .suggestions-label {
      font: var(--type-small);
      color: var(--fg-muted);
      width: 100%;
    }
    .tag {
      padding: 2px var(--space-2);
      border-radius: var(--radius-pill);
      background: rgba(39, 50, 72, 0.06);
      font: var(--type-small);
      color: var(--fg-muted);
    }
    .tag.mine {
      background: rgba(95, 158, 160, 0.2);
      color: var(--fg);
      font-weight: 700;
    }
    .captain-row {
      margin-top: var(--space-3);
      padding-top: var(--space-2);
      border-top: 1px dashed rgba(39, 50, 72, 0.15);
      display: flex;
      gap: var(--space-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .captain-label {
      font: var(--type-small);
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      width: 100%;
    }
    button.lock-btn {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      border: 1.5px solid var(--wv-redwood);
      background: var(--bg-card);
      color: var(--accent-emphasis);
      font: var(--type-small);
      font-weight: 700;
      cursor: pointer;
      transition: background var(--dur-base) var(--ease-out-quart);
    }
    button.lock-btn[data-locked] {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
    }
    button.lock-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .locked-tag {
      font: var(--type-small);
      color: var(--accent-emphasis);
      font-weight: 700;
    }
  `;

  private vote(raw: string) {
    if (!this.team || !this.participantId) return;
    const amount = Math.max(0, Math.min(STARTING_CREDOS, parseInt(raw, 10) || 0));
    this.dispatchEvent(
      new CustomEvent('va-poll-vote', {
        detail: {
          teamId: this.team.id,
          valueId: this.valueId,
          participantId: this.participantId,
          amount,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private lockWithAmount(raw: string) {
    if (!this.team) return;
    const amount = Math.max(0, Math.min(STARTING_CREDOS, parseInt(raw, 10) || 0));
    this.dispatchEvent(
      new CustomEvent('va-bid-lock', {
        detail: { teamId: this.team.id, valueId: this.valueId, amount },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private unlock() {
    if (!this.team) return;
    this.dispatchEvent(
      new CustomEvent('va-bid-unlock', {
        detail: { teamId: this.team.id, valueId: this.valueId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.team) return html``;
    const votes = this.team.polls[this.valueId] ?? {};
    const myVote = votes[this.participantId];
    const lockedAt = this.team.lockedBids?.[this.valueId];
    const isLocked = typeof lockedAt === 'number';

    // collect teammate suggestions (excluding self) for captain view
    const allVotes = Object.entries(votes).filter(([pid]) => pid !== this.participantId);
    const tally = pollTally(this.team, this.valueId);

    return html`
      <div class="prompt">${COPY.strategy.pollPrompt}</div>

      <!-- participant input: their suggestion -->
      <div class="input-row">
        <input
          type="number"
          min="0"
          max=${STARTING_CREDOS}
          placeholder="0"
          .value=${this.draft || (myVote != null ? String(myVote) : '')}
          ?disabled=${isLocked && !this.captain}
          aria-label="your bid suggestion in credos"
          @input=${(e: Event) => {
            this.draft = (e.target as HTMLInputElement).value;
          }}
          @change=${(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            this.draft = val;
            this.vote(val);
          }}
          @blur=${(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            if (val) this.vote(val);
          }}
        />
        <span class="unit">credos</span>
      </div>

      <!-- show suggestions from other teammates -->
      ${tally.total > 0
        ? html`
            <div class="suggestions">
              <span class="suggestions-label">team suggestions</span>
              ${myVote != null
                ? html`<span class="tag mine">you: ${myVote}</span>`
                : ''}
              ${allVotes.map(
                ([, amount]) => html`<span class="tag">${amount}</span>`,
              )}
            </div>
          `
        : ''}

      <!-- captain controls -->
      ${this.captain
        ? html`
            <div class="captain-row">
              <span class="captain-label">captain — lock final bid</span>
              ${!isLocked
                ? html`
                    <input
                      type="number"
                      min="0"
                      max=${STARTING_CREDOS}
                      placeholder=${tally.leadingAmount != null
                        ? String(tally.leadingAmount)
                        : '0'}
                      .value=${this.lockDraft}
                      aria-label="final locked bid amount"
                      @input=${(e: Event) => {
                        this.lockDraft = (e.target as HTMLInputElement).value;
                      }}
                    />
                    <span class="unit">credos</span>
                    <button
                      type="button"
                      class="lock-btn"
                      @click=${() => {
                        const val = this.lockDraft || (tally.leadingAmount != null ? String(tally.leadingAmount) : '0');
                        this.lockWithAmount(val);
                        this.lockDraft = '';
                      }}
                    >
                      ${COPY.strategy.lockBid}
                    </button>
                  `
                : html`
                    <span class="locked-tag">${COPY.strategy.lockedAt(lockedAt)}</span>
                    <button
                      type="button"
                      class="lock-btn"
                      data-locked
                      @click=${() => this.unlock()}
                    >
                      ${COPY.strategy.unlockBid}
                    </button>
                  `}
            </div>
          `
        : isLocked
          ? html`
              <div class="captain-row">
                <span class="locked-tag">${COPY.strategy.lockedAt(lockedAt)}</span>
              </div>
            `
          : ''}
    `;
  }
}
