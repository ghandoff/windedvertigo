import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { COPY } from '@/content/copy';
import { POLL_AMOUNTS } from '@/state/types';
import { pollTally } from '@/state/selectors';
import type { Team } from '@/state/types';

/**
 * embedded team poll for a single value, used during team strategy and
 * restrategize. emits `va-poll-vote` with the selected amount.
 *
 * also surfaces the captain's lock controls when `captain` is true.
 */
@customElement('va-poll-buttons')
export class VaPollButtons extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: String }) valueId = '';
  @property({ type: String }) participantId = '';
  @property({ type: Boolean }) captain = false;

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
    .buttons {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--space-1);
    }
    @media (min-width: 480px) {
      .buttons {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
    }
    button.choice {
      min-height: 48px;
      padding: var(--space-2) 0;
      border-radius: var(--radius-pill);
      border: 2px solid var(--wv-cadet-blue);
      background: var(--bg-card);
      color: var(--fg);
      font: var(--type-small);
      font-weight: 700;
      cursor: pointer;
      line-height: 1.1;
      text-align: center;
      transition:
        background var(--dur-base) var(--ease-out-quart),
        color var(--dur-base) var(--ease-out-quart),
        transform var(--dur-base) var(--ease-out-quart);
    }
    @media (min-width: 480px) {
      button.choice {
        min-width: 64px;
        padding: var(--space-2) var(--space-3);
      }
    }
    button.choice:hover {
      transform: translateY(-1px);
    }
    button.choice:focus-visible {
      transform: translateY(-1px);
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    button.choice[data-selected] {
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
    }
    button.choice .label,
    button.choice .amount {
      display: block;
    }
    button.choice .amount {
      font: var(--type-mono);
      font-size: 11px;
      opacity: 0.8;
    }
    @media (min-width: 480px) {
      button.choice .label,
      button.choice .amount {
        display: inline;
      }
      button.choice .amount::before {
        content: ' ';
      }
      button.choice .amount {
        font-size: inherit;
      }
    }
    .results {
      margin-top: var(--space-2);
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
      font: var(--type-small);
      color: var(--fg-muted);
    }
    .results.consensus {
      color: var(--wv-redwood);
      font-weight: 700;
    }
    .results .tag {
      padding: 2px var(--space-2);
      border-radius: var(--radius-pill);
      background: rgba(39, 50, 72, 0.06);
    }
    .results.consensus .tag {
      background: rgba(177, 80, 67, 0.12);
    }
    .captain-row {
      margin-top: var(--space-2);
      display: flex;
      gap: var(--space-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .captain-row button {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      border: 1.5px solid var(--wv-redwood);
      background: var(--bg-card);
      color: var(--wv-redwood);
      font: var(--type-small);
      font-weight: 700;
      cursor: pointer;
    }
    .captain-row button[data-locked] {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
    }
    .captain-row .locked-tag {
      font: var(--type-small);
      color: var(--wv-redwood);
      font-weight: 700;
    }
  `;

  private vote(amount: number) {
    if (!this.team || !this.participantId) return;
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

  private lockCurrent() {
    if (!this.team) return;
    const lockedAt = this.team.lockedBids?.[this.valueId];
    if (typeof lockedAt === 'number') {
      this.dispatchEvent(
        new CustomEvent('va-bid-unlock', {
          detail: { teamId: this.team.id, valueId: this.valueId },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    const tally = pollTally(this.team, this.valueId);
    const amount = tally.leadingAmount ?? 0;
    this.dispatchEvent(
      new CustomEvent('va-bid-lock', {
        detail: { teamId: this.team.id, valueId: this.valueId, amount },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.team) return html``;
    const labels = COPY.strategy.pollLabels;
    const votes = this.team.polls[this.valueId] ?? {};
    const myVote = votes[this.participantId];
    const tally = pollTally(this.team, this.valueId);
    const lockedAt = this.team.lockedBids?.[this.valueId];
    const hasConsensus = tally.leadingShare >= 0.6 && tally.total > 0;
    return html`
      <div class="prompt">${COPY.strategy.pollPrompt}</div>
      <div class="buttons" role="radiogroup" aria-label=${COPY.strategy.pollPrompt}>
        ${POLL_AMOUNTS.map(
          (amount) => html`
            <button
              type="button"
              class="choice"
              role="radio"
              aria-label=${`${labels[amount]}, ${amount} credos`}
              aria-checked=${myVote === amount ? 'true' : 'false'}
              data-selected=${myVote === amount ? true : null}
              @click=${() => this.vote(amount)}
            >
              <span class="label">${labels[amount]}</span>
              <span class="amount">${amount}</span>
            </button>
          `,
        )}
      </div>
      <div
        class=${`results${hasConsensus ? ' consensus' : ''}`}
        aria-live="polite"
      >
        ${tally.total === 0
          ? html`<span>no votes yet.</span>`
          : Array.from(tally.tally.entries())
              .sort((a, b) => b[1] - a[1])
              .map(
                ([amount, count]) =>
                  html`<span class="tag">${count} × ${amount}</span>`,
              )}
        ${hasConsensus && tally.leadingAmount !== null
          ? html`<span>· ${COPY.strategy.leaning(tally.leadingAmount)}</span>`
          : tally.total > 0
            ? html`<span>· ${COPY.strategy.splitTeam}</span>`
            : ''}
      </div>
      ${this.captain
        ? html`
            <div class="captain-row">
              <button
                type="button"
                data-locked=${typeof lockedAt === 'number' ? true : null}
                @click=${() => this.lockCurrent()}
                aria-label=${typeof lockedAt === 'number'
                  ? COPY.strategy.unlockBid
                  : COPY.strategy.lockBid}
              >
                ${typeof lockedAt === 'number'
                  ? COPY.strategy.unlockBid
                  : COPY.strategy.lockBid}
              </button>
              ${typeof lockedAt === 'number'
                ? html`<span class="locked-tag"
                    >${COPY.strategy.lockedAt(lockedAt)}</span
                  >`
                : ''}
            </div>
          `
        : typeof lockedAt === 'number'
          ? html`<div class="captain-row">
              <span class="locked-tag">${COPY.strategy.lockedAt(lockedAt)}</span>
            </div>`
          : ''}
    `;
  }
}
