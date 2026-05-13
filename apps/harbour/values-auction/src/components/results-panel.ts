import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { COPY } from '@/content/copy';
import { getValue } from '@/content/values';
import type { Session, Team } from '@/state/types';

/**
 * mid-auction restrategize panel. shows the team what they've won, lost,
 * and what every other team has paid for — the "real data" they revise on.
 */
@customElement('va-results-panel')
export class VaResultsPanel extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: Object }) session?: Session;

  static styles = css`
    :host {
      display: block;
    }
    .grid {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: 1fr;
    }
    @media (min-width: 720px) {
      .grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    .panel {
      background: var(--bg-card);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .panel h3 {
      font: var(--type-h2);
      margin: 0 0 var(--space-3);
    }
    .remaining {
      font: var(--type-display);
      font-size: 56px;
      color: var(--accent-emphasis);
      line-height: 1;
    }
    .remaining-label {
      font: var(--type-small);
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: var(--space-2);
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--bg);
      border-radius: var(--radius-sm);
      font-size: 14px;
    }
    li[data-empty] {
      color: var(--fg-muted);
    }
    .pricetag {
      font: var(--type-mono);
      font-weight: 700;
    }
    .colour {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: var(--space-2);
      vertical-align: middle;
    }
  `;

  render() {
    if (!this.team || !this.session) return html``;
    const myTeamId = this.team.id;
    const won = this.session.completedAuctions.filter(
      (a) => a.winnerTeamId === myTeamId,
    );
    const lost = this.session.completedAuctions.filter(
      (a) => a.winnerTeamId && a.winnerTeamId !== myTeamId,
    );
    const competition = this.session.completedAuctions
      .filter((a) => a.winnerTeamId)
      .sort((a, b) => (b.highBid?.amount ?? 0) - (a.highBid?.amount ?? 0));
    return html`
      <div class="grid">
        <section class="panel">
          <div class="remaining-label">${COPY.restrategize.remainingCredos}</div>
          <div class="remaining">${this.team.credos}</div>
          <h3 style="margin-top: var(--space-4)">${COPY.restrategize.wonHeading}</h3>
          <ul>
            ${won.length === 0
              ? html`<li data-empty>nothing won yet.</li>`
              : won.map((a) => {
                  const v = getValue(a.valueId);
                  return html`<li>
                    <span>${v?.name ?? a.valueId}</span>
                    <span class="pricetag"
                      >${COPY.restrategize.pricePaid(a.highBid?.amount ?? 0)}</span
                    >
                  </li>`;
                })}
          </ul>
          <h3 style="margin-top: var(--space-4)">${COPY.restrategize.lostHeading}</h3>
          <ul>
            ${lost.length === 0
              ? html`<li data-empty>nothing lost yet.</li>`
              : lost.map((a) => {
                  const v = getValue(a.valueId);
                  const winner = this.session?.teams.find(
                    (t) => t.id === a.winnerTeamId,
                  );
                  return html`<li>
                    <span
                      >${v?.name ?? a.valueId} — to
                      <span class="colour" style=${`background: var(--team-${winner?.colour})`}></span
                      >${winner?.name ?? '?'}</span
                    >
                    <span class="pricetag"
                      >${COPY.restrategize.pricePaid(a.highBid?.amount ?? 0)}</span
                    >
                  </li>`;
                })}
          </ul>
        </section>
        <section class="panel">
          <h3>${COPY.restrategize.competitionHeading}</h3>
          <ul>
            ${competition.length === 0
              ? html`<li data-empty>no winners yet.</li>`
              : competition.map((a) => {
                  const v = getValue(a.valueId);
                  const winner = this.session?.teams.find(
                    (t) => t.id === a.winnerTeamId,
                  );
                  return html`<li>
                    <span>
                      <span class="colour" style=${`background: var(--team-${winner?.colour})`}></span
                      >${winner?.name ?? '?'} · ${v?.name ?? a.valueId}
                    </span>
                    <span class="pricetag"
                      >${COPY.restrategize.pricePaid(a.highBid?.amount ?? 0)}</span
                    >
                  </li>`;
                })}
          </ul>
        </section>
      </div>
    `;
  }
}
