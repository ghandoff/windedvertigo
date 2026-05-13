import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Controller } from '@/state/controller';
import type { Broadcast, Session } from '@/state/types';
import { COPY } from '@/content/copy';
import { getValue } from '@/content/values';
import {
  brainstormSubmittedCount,
  latestBroadcast,
  totalParticipants,
  visibleBrainstorm,
} from '@/state/selectors';
import '@/components/countdown';
import '@/components/value-card';
import '@/components/identity-card';

@customElement('va-wall')
export class VaWall extends LitElement {
  @property({ attribute: false }) controller?: Controller;
  @property({ type: String }) code = 'DEMO';

  @state() private session?: Session;
  @state() private shownBroadcast?: Broadcast;
  private unsub?: () => void;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.unsub = this.controller?.store.subscribe((s) => {
      this.session = s;
      this.maybeUpdateBroadcast(s);
    });
    this.session = this.controller?.store.getState();
    if (this.session) this.maybeUpdateBroadcast(this.session);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
  }

  private maybeUpdateBroadcast(s: Session) {
    const latest = latestBroadcast(s);
    if (!latest) return;
    if (latest.id === this.shownBroadcast?.id) return;
    this.shownBroadcast = latest;
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
    this.broadcastTimer = setTimeout(() => {
      if (this.shownBroadcast?.id === latest.id) this.shownBroadcast = undefined;
    }, 15_000);
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      padding: var(--space-6);
    }
    .centre {
      min-height: calc(100vh - var(--space-6) * 2);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .wordmark {
      height: 80px;
      margin-bottom: var(--space-6);
    }
    .code {
      font: var(--type-mono);
      font-size: 72px;
      color: var(--wv-cadet-blue);
      background: var(--bg-card);
      padding: var(--space-4) var(--space-6);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      letter-spacing: 0.2em;
    }
    .count {
      margin-top: var(--space-5);
      font: var(--type-display);
      color: var(--fg-muted);
    }
    .auction {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-6);
      align-items: center;
      justify-items: center;
      min-height: calc(100vh - var(--space-6) * 2);
      padding: var(--space-5);
    }
    .auction .big-card {
      max-width: 900px;
    }
    .auction .high {
      font: var(--type-display);
      font-size: 56px;
    }
    .auction .colour-block {
      display: block;
      width: 100%;
      height: 60px;
      border-radius: var(--radius-md);
      margin-top: var(--space-4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--space-5);
      padding: var(--space-5);
    }
    .regather {
      max-width: 1600px;
      margin: 0 auto;
      padding: var(--space-5);
    }
    .regather-header {
      margin-bottom: var(--space-6);
    }
    .regather-header h1 {
      font: var(--type-display);
      margin-bottom: var(--space-2);
      text-align: center;
    }
    .regather-header p {
      color: var(--fg-muted);
      max-width: 70ch;
      margin: 0 auto;
      line-height: 1.6;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: var(--space-5);
    }
    .card-cell {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--bg-card);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .card-cell .purpose {
      color: var(--fg);
      line-height: 1.5;
      margin: 0;
      padding-left: var(--space-3);
      border-left: 3px solid var(--wv-cadet-blue);
    }
    .patterns {
      margin-top: var(--space-6);
      padding: var(--space-5);
      background: var(--bg-card);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .patterns h2 {
      font: var(--type-h1);
      margin-bottom: var(--space-4);
      text-align: center;
    }
    .patterns ul {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--space-3);
      padding: 0;
      margin: 0;
    }
    .patterns li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      background: var(--bg);
      border-radius: var(--radius-sm);
    }
    .patterns .pattern-name {
      font-weight: 700;
      color: var(--wv-cadet-blue);
    }
    .patterns .pattern-count {
      font: var(--type-mono);
      font-weight: 700;
      color: var(--wv-redwood);
    }
    .broadcast {
      position: fixed;
      left: 50%;
      top: var(--space-5);
      transform: translateX(-50%);
      max-width: min(80vw, 960px);
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      padding: var(--space-4) var(--space-5);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      z-index: 10;
      animation: va-spring-pulse var(--dur-base) var(--ease-spring);
    }
    .broadcast .label {
      font: var(--type-small);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      opacity: 0.85;
      margin-bottom: var(--space-1);
    }
    .broadcast .message {
      font: var(--type-h2);
      line-height: 1.3;
    }
  `;

  private renderIdle() {
    return html`
      <div class="centre">
        <img class="wordmark" src="/wordmark.svg" alt="winded.vertigo" />
        <div class="code" aria-label=${COPY.wall.joinAt(this.code)}>${this.code}</div>
        <div class="count">${totalParticipants(this.session!)} joined</div>
      </div>
    `;
  }

  private renderBrainstorm() {
    if (!this.session) return html``;
    const responses = visibleBrainstorm(this.session);
    const total = totalParticipants(this.session);
    const responded = brainstormSubmittedCount(this.session);
    return html`
      <div style="padding: var(--space-5); max-width: 1600px; margin: 0 auto;">
        <header style="text-align: center; margin-bottom: var(--space-5);">
          <h1 style="font: var(--type-display);">${COPY.brainstorm.wallHeading}</h1>
          <p style="font: var(--type-mono); color: var(--fg-muted); margin-top: var(--space-2);">
            ${COPY.brainstorm.counter(responded, total)}
          </p>
        </header>
        <div
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3);"
        >
          ${[...responses]
            .sort((a, b) => b.at - a.at)
            .map(
              (r) => html`
                <div
                  style="padding: var(--space-3) var(--space-4); background: var(--bg-card); border-left: 4px solid var(--wv-cadet-blue); border-radius: var(--radius-sm); line-height: 1.4; font-size: 18px;"
                >
                  ${r.text}
                </div>
              `,
            )}
        </div>
      </div>
    `;
  }

  private renderAuction(practice = false) {
    const auction = this.session?.currentAuction;
    if (!auction) return this.renderIdle();
    const v = practice
      ? { id: '__practice__', name: COPY.practice.dummyValueName, description: COPY.practice.dummyValueDescription }
      : getValue(auction.valueId);
    const highTeam = this.session?.teams.find((t) => t.id === auction.highBid?.teamId);
    return html`
      <div class="auction">
        ${practice
          ? html`<div style="font: var(--type-mono); color: var(--wv-burnt-sienna); letter-spacing: 0.2em; text-transform: uppercase;">${COPY.practice.badge}</div>`
          : ''}
        <div class="big-card">
          <va-value-card .value=${v} zone="must" large></va-value-card>
        </div>
        <va-countdown
          ring
          .startedAt=${auction.startedAt}
          .durationMs=${auction.durationMs}
        ></va-countdown>
        ${highTeam && auction.highBid
          ? html`
              <div class="high" aria-live="polite">
                ${highTeam.name}: ${auction.highBid.amount} credos
                <span
                  class="colour-block"
                  style=${`background: var(--team-${highTeam.colour})`}
                ></span>
              </div>
            `
          : html`<div class="high" style="color: var(--fg-muted)">${COPY.auction.noBidsYet}</div>`}
      </div>
    `;
  }

  private renderReflection() {
    if (!this.session) return html``;
    return html`
      <div class="grid">
        ${this.session.teams.map(
          (t) => html`<va-identity-card .team=${t}></va-identity-card>`,
        )}
      </div>
    `;
  }

  private renderRegather() {
    if (!this.session) return html``;
    const valueWinners = new Map<string, number>();
    for (const a of this.session.completedAuctions) {
      if (a.winnerTeamId) valueWinners.set(a.valueId, (valueWinners.get(a.valueId) ?? 0) + 1);
    }
    const sortedTeams = [...this.session.teams];
    return html`
      <div class="regather">
        <header class="regather-header">
          <h1>${COPY.wall.regatherHeading}</h1>
          <p>${COPY.wall.regatherSubheading}</p>
        </header>
        <div class="card-grid">
          ${sortedTeams.map(
            (t) => html`
              <div class="card-cell">
                <va-identity-card .team=${t}></va-identity-card>
                <p class="purpose">${t.purposeStatement ?? ''}</p>
              </div>
            `,
          )}
        </div>
        ${valueWinners.size > 0
          ? html`
              <section class="patterns">
                <h2>${COPY.wall.patternsHeading}</h2>
                <ul>
                  ${Array.from(valueWinners.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([valueId, count]) => {
                      const v = getValue(valueId);
                      return v
                        ? html`<li>
                            <span class="pattern-name">${v.name}</span>
                            <span class="pattern-count"
                              >${count} team${count === 1 ? '' : 's'}</span
                            >
                          </li>`
                        : '';
                    })}
                </ul>
              </section>
            `
          : ''}
      </div>
    `;
  }

  private renderBroadcastOverlay() {
    if (!this.shownBroadcast) return html``;
    return html`
      <div class="broadcast" role="status" aria-live="polite">
        <div class="label">${COPY.broadcast.label}</div>
        <div class="message">${this.shownBroadcast.message}</div>
      </div>
    `;
  }

  render() {
    if (!this.session) return html`<p>loading…</p>`;
    const act = this.session.currentAct;
    let body;
    if (act === 'brainstorm') body = this.renderBrainstorm();
    else if (act === 'practice') body = this.renderAuction(true);
    else if (act === 'auction') body = this.renderAuction(false);
    else if (act === 'reflection') body = this.renderReflection();
    else if (act === 'regather') body = this.renderRegather();
    else body = this.renderIdle();
    return html`${this.renderBroadcastOverlay()}${body}`;
  }
}
