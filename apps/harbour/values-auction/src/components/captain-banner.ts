import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { COPY } from '@/content/copy';
import type { Participant, Team } from '@/state/types';

/**
 * top-of-screen captain banner. three states:
 *   - no captain yet → "tap to claim" cta
 *   - you are captain → confirmation + "pass role" handler
 *   - someone else is captain → their name
 */
@customElement('va-captain-banner')
export class VaCaptainBanner extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: Array }) teammates: Participant[] = [];
  @property({ type: String }) participantId = '';

  static styles = css`
    :host {
      display: block;
      margin-bottom: var(--space-4);
    }
    .banner {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      box-shadow: var(--shadow-card);
    }
    .banner[data-state='claimed'] {
      background: var(--wv-seafoam);
    }
    .banner[data-state='other'] {
      background: var(--bg-card);
      color: var(--fg);
      border: 1px solid rgba(39, 50, 72, 0.1);
      box-shadow: none;
    }
    button.claim {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      background: var(--fg-inverse);
      color: var(--accent-emphasis);
      border: 0;
      font-weight: 700;
      cursor: pointer;
    }
    .pass {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }
    select {
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.1);
      color: var(--fg-inverse);
      font: var(--type-small);
    }
    button.pass-btn {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.15);
      color: var(--fg-inverse);
      border: 1px solid rgba(255, 255, 255, 0.4);
      font: var(--type-small);
      cursor: pointer;
    }
    .label {
      font: var(--type-small);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.75;
      display: block;
      margin-bottom: 2px;
    }
    .name {
      font-weight: 700;
    }
    .next-line {
      margin-top: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--bg-card);
      color: var(--fg);
      border-left: 3px solid var(--wv-redwood);
      border-radius: var(--radius-sm);
      font: var(--type-small);
      line-height: 1.5;
      width: 100%;
      box-sizing: border-box;
    }
  `;

  private claim() {
    if (!this.team) return;
    this.dispatchEvent(
      new CustomEvent('va-captain-claim', {
        detail: { teamId: this.team.id, participantId: this.participantId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private pass(toParticipantId: string) {
    if (!this.team || !toParticipantId) return;
    this.dispatchEvent(
      new CustomEvent('va-captain-pass', {
        detail: { teamId: this.team.id, toParticipantId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.team) return html``;
    const captainId = this.team.captainParticipantId;
    if (!captainId) {
      return html`
        <div class="banner" data-state="open" role="status">
          <div>
            <span class="label">bid captain</span>
            <span class="name">${COPY.strategy.captainNoneYet}</span>
          </div>
          <button type="button" class="claim" @click=${() => this.claim()}>
            ${COPY.strategy.captainCta}
          </button>
        </div>
      `;
    }
    if (captainId === this.participantId) {
      const others = this.teammates.filter((p) => p.id !== this.participantId);
      return html`
        <div class="banner" data-state="claimed" role="status">
          <div>
            <span class="label">bid captain</span>
            <span class="name">${COPY.strategy.captainSelf}</span>
          </div>
          ${others.length > 0
            ? html`
                <div class="pass">
                  <select
                    aria-label=${COPY.strategy.captainPass}
                    @change=${(e: Event) =>
                      this.pass((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">${COPY.strategy.captainPass}…</option>
                    ${others.map(
                      (p) => html`<option value=${p.id}>${p.displayName}</option>`,
                    )}
                  </select>
                </div>
              `
            : ''}
        </div>
      `;
    }
    const captain = this.teammates.find((p) => p.id === captainId);
    const name = captain?.displayName ?? 'a teammate';
    // the next-in-line is the first non-captain teammate by joinedAt — this
    // mirrors main.ts's auto-transfer logic. surface it so the would-be
    // replacement knows the role can land on them without warning.
    const nextInLine = [...this.teammates]
      .filter((p) => p.id !== captainId)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    const meIsNext = nextInLine?.id === this.participantId;
    return html`
      <div class="banner" data-state="other" role="status">
        <div style="flex: 1; min-width: 0;">
          <span class="label">bid captain</span>
          <span class="name">${COPY.strategy.captainIs(name)}</span>
          ${meIsNext
            ? html`<p class="next-line">${COPY.strategy.captainNextInLine(name)}</p>`
            : ''}
        </div>
      </div>
    `;
  }
}
