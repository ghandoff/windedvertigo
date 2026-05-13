import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Participant, Team } from '@/state/types';

/**
 * persistent team identifier shown in the participant header on every act
 * after grouping. compact chip — click to expand a roster popover so the
 * participant can confirm they're in the right breakout without asking a
 * facilitator.
 */
@customElement('va-team-chip')
export class VaTeamChip extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: Array }) teammates: Participant[] = [];
  @property({ type: String }) participantId = '';

  @state() private open = false;

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }
    button.chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: 6px var(--space-3);
      border-radius: var(--radius-pill);
      border: 1.5px solid var(--border-soft);
      background: var(--bg-card);
      color: var(--fg-on-card);
      font: var(--type-small);
      font-weight: 700;
      cursor: pointer;
      line-height: 1.2;
    }
    button.chip:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .captain-mark {
      font: var(--type-mono);
      color: var(--accent-emphasis);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .pop {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      min-width: 240px;
      max-width: 320px;
      padding: var(--space-3);
      background: var(--bg-card);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card-lifted);
      z-index: 30;
      animation: va-fade-in var(--dur-base) var(--ease-out-quart);
    }
    .pop h4 {
      margin: 0 0 var(--space-2);
      font: var(--type-h2);
      font-size: 16px;
    }
    .pop ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pop li {
      display: flex;
      justify-content: space-between;
      gap: var(--space-2);
      font: var(--type-small);
      color: var(--fg);
    }
    .pop li .role {
      color: var(--accent-emphasis);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .pop li.you {
      color: var(--wv-seafoam);
      font-weight: 700;
    }
    .pop .empty {
      color: var(--fg-muted);
      font: var(--type-small);
    }
    @media (max-width: 639px) {
      button.chip {
        padding: 4px var(--space-2);
        font-size: 11px;
      }
      .captain-mark {
        display: none;
      }
    }
  `;

  private toggle() {
    this.open = !this.open;
  }

  private onBlur(e: FocusEvent) {
    // close popover when focus leaves the chip; allow children to keep focus
    const next = e.relatedTarget as Node | null;
    if (next && this.renderRoot.contains(next as Node)) return;
    this.open = false;
  }

  render() {
    if (!this.team) return html``;
    const captain = this.team.captainParticipantId;
    return html`
      <button
        type="button"
        class="chip"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-label=${`team ${this.team.name}. ${this.teammates.length} teammates. tap to view roster.`}
        @click=${() => this.toggle()}
        @blur=${(e: FocusEvent) => this.onBlur(e)}
      >
        <span class="swatch" style=${`background: var(--team-${this.team.colour})`}></span>
        ${this.team.name}
        ${captain === this.participantId
          ? html`<span class="captain-mark" aria-label="bid captain">★ captain</span>`
          : ''}
      </button>
      ${this.open
        ? html`
            <div class="pop" role="dialog" aria-label="team roster">
              <h4>${this.team.name}</h4>
              ${this.teammates.length === 0
                ? html`<p class="empty">just you, for now.</p>`
                : html`
                    <ul>
                      ${this.teammates.map(
                        (p) => html`
                          <li class=${p.id === this.participantId ? 'you' : ''}>
                            <span
                              >${p.displayName}${p.id === this.participantId
                                ? ' (you)'
                                : ''}</span
                            >
                            ${p.id === captain
                              ? html`<span class="role">captain</span>`
                              : ''}
                          </li>
                        `,
                      )}
                    </ul>
                  `}
            </div>
          `
        : ''}
    `;
  }
}
