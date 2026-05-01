import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Controller } from '@/state/controller';
import type { Session } from '@/state/types';
import { COPY } from '@/content/copy';
import { ACTS } from '@/content/acts';
import { VALUES } from '@/content/values';
import { DEFAULT_AUCTION_MS, advanceAct, assignTeams } from '@/state/reducers';
import { prevAct } from '@/content/acts';
import { bidsPerMinute, readyCount, silentTeams } from '@/state/selectors';
import { startTicker } from '@/utils/timer';
import '@/components/va-card';
import '@/components/va-button';
import '@/components/credos-stack';
import '@/components/countdown';
import '@/components/act-timeline';
import '@/components/value-card';

@customElement('va-facilitator')
export class VaFacilitator extends LitElement {
  @property({ attribute: false }) controller?: Controller;
  @property({ type: String }) code = 'DEMO';

  @state() private session?: Session;
  @state() private broadcastDraft = '';
  @state() private nextValueId: string | null = null;
  @state() private tickNow = Date.now();
  @state() private pendingJump: string | null = null;
  @state() private copied: 'join' | 'wall' | null = null;

  private unsub?: () => void;
  private ticker: { stop(): void } | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  private joinUrl(): string {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#/join?code=${encodeURIComponent(this.code)}`;
  }

  private wallUrl(): string {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#/wall?code=${encodeURIComponent(this.code)}`;
  }

  private async copyLink(which: 'join' | 'wall') {
    const url = which === 'join' ? this.joinUrl() : this.wallUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard unavailable (insecure context, permissions) — fall back to selection
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // last resort: leave url on clipboard attempt; user can retry
      }
      document.body.removeChild(ta);
    }
    this.copied = which;
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.copyResetTimer = setTimeout(() => {
      this.copied = null;
    }, 1800);
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.controller) {
      this.unsub = this.controller.store.subscribe((s) => (this.session = s));
      this.session = this.controller.store.getState();
      // only init when there's truly no session in progress.
      // if a participant already joined, refreshing the facilitator must not wipe them.
      if (
        this.session.currentAct === 'arrival' &&
        !this.session.startedAt &&
        this.session.participants.length === 0
      ) {
        this.controller.dispatch({
          type: 'SESSION_INIT',
          sessionId: this.code,
          facilitatorId: 'facilitator-local',
        });
      }
    }
    this.ticker = startTicker((n) => (this.tickNow = n), 500);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
    this.ticker?.stop();
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
  }

  private startSession() {
    this.controller?.dispatch({ type: 'SESSION_START' });
  }

  private advance() {
    if (!this.session) return;
    const act = advanceAct(this.session);
    if (act) {
      // on entering scene or strategy, make sure teams are formed
      if (
        (act.type === 'ACT_ADVANCE' && act.to === 'scene' && this.session.teams.length === 0) ||
        (act.type === 'ACT_ADVANCE' && act.to === 'scene')
      ) {
        if (this.session.teams.length === 0) this.formTeams();
      }
      this.controller?.dispatch(act);
    }
  }

  private extend() {
    this.controller?.dispatch({ type: 'ACT_EXTEND', addMs: 30_000 });
  }

  private goBack() {
    if (!this.session) return;
    const prev = prevAct(this.session.currentAct);
    if (prev) this.controller?.dispatch({ type: 'ACT_ADVANCE', to: prev, at: Date.now() });
  }

  private formTeams() {
    if (!this.session) return;
    const { teams, assignments } = assignTeams(
      this.session.participants.filter((p) => p.role === 'participant'),
    );
    this.controller?.dispatch({ type: 'TEAMS_FORM', teams, assignments });
  }

  private confirmJump(to: string) {
    if (!this.pendingJump) {
      this.pendingJump = to;
      return;
    }
    if (this.pendingJump !== to) {
      this.pendingJump = to;
      return;
    }
    this.controller?.dispatch({ type: 'ACT_ADVANCE', to: to as any, at: Date.now() });
    this.pendingJump = null;
  }

  private startAuction() {
    if (!this.nextValueId) return;
    this.controller?.dispatch({
      type: 'AUCTION_START',
      valueId: this.nextValueId,
      durationMs: DEFAULT_AUCTION_MS,
      at: Date.now(),
    });
  }

  private endAuction() {
    this.controller?.dispatch({ type: 'AUCTION_END', at: Date.now() });
    this.nextValueId = null;
  }

  private broadcast() {
    if (!this.broadcastDraft.trim()) return;
    this.controller?.dispatch({
      type: 'BROADCAST',
      message: this.broadcastDraft.trim(),
      at: Date.now(),
    });
    this.broadcastDraft = '';
  }

  private resetBid() {
    this.controller?.dispatch({ type: 'RESET_CURRENT_BID', at: Date.now() });
  }

  private muteTeam(teamId: string, muted: boolean) {
    this.controller?.dispatch({ type: 'MUTE_TEAM', teamId, muted });
  }

  private downloadAllCards() {
    if (!this.session) return;
    for (const t of this.session.teams) {
      this.dispatchEvent(
        new CustomEvent('va-download-card', {
          detail: { teamId: t.id },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: 280px 1fr 340px;
      gap: var(--space-5);
      padding: var(--space-5);
      min-height: 100vh;
      align-items: start;
      box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    @media (max-width: 1100px) {
      :host {
        grid-template-columns: 1fr;
      }
    }
    header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
    }
    .wordmark {
      height: 32px;
    }
    .session-share {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      background: var(--bg-card);
      padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .session-share .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .session-share .label {
      font: var(--type-small);
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .session-share .code-value {
      font: var(--type-mono);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--wv-cadet-blue);
    }
    .session-share .share-actions {
      display: flex;
      gap: var(--space-2);
    }
    .session-share .hint {
      font: var(--type-small);
      color: var(--fg-muted);
    }
    .copied-toast {
      font: var(--type-small);
      color: var(--fg-muted);
      margin-left: var(--space-2);
    }
    .panel {
      background: var(--bg-card);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      box-shadow: var(--shadow-card);
    }
    .panel h2 {
      font: var(--type-h2);
      margin-bottom: var(--space-3);
    }
    .signal dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-2) var(--space-4);
    }
    .signal dt {
      color: var(--fg-muted);
      font-size: 14px;
    }
    .signal dd {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .team-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .team-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) var(--space-3);
      background: var(--bg);
      border-radius: var(--radius-sm);
    }
    .team-row .colour {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: var(--space-2);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }
    .deck {
      max-height: 360px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .deck button {
      text-align: left;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: 2px solid transparent;
      background: var(--bg);
      font-weight: 700;
    }
    .deck button[data-selected='true'] {
      border-color: var(--wv-redwood);
    }
    .deck button:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    input[type='text'] {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-pill);
      border: 2px solid var(--wv-cadet-blue);
      background: var(--bg-card);
      width: 100%;
      margin-bottom: var(--space-2);
    }
    .tools {
      margin-top: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .jump-confirm {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      margin-top: var(--space-3);
      font-size: 14px;
    }
    .jump-confirm va-button {
      margin-top: var(--space-2);
    }
    .session-end-note {
      margin: 0;
      padding: var(--space-3);
      background: var(--bg);
      border-left: 3px solid var(--wv-cadet-blue);
      color: var(--fg);
      font-weight: 700;
      line-height: 1.4;
    }
    .deck-steps {
      list-style: none;
      counter-reset: step;
      padding: 0;
      margin: 0 0 var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .deck-steps li {
      counter-increment: step;
      padding: var(--space-2) var(--space-3);
      background: var(--bg);
      border-left: 3px solid rgba(39, 50, 72, 0.25);
      font-size: 14px;
      line-height: 1.4;
      color: var(--fg);
      position: relative;
      padding-left: calc(var(--space-3) + 28px);
    }
    .deck-steps li::before {
      content: counter(step);
      position: absolute;
      left: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      font-weight: 700;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .deck-steps li[data-done] {
      border-left-color: var(--wv-redwood);
      color: var(--fg-muted);
    }
    .deck-steps li[data-done]::before {
      background: var(--wv-redwood);
      content: '✓';
    }
    .deck-warning {
      margin-top: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--bg);
      border-left: 3px solid var(--wv-redwood);
      color: var(--wv-redwood);
      font-size: 14px;
      line-height: 1.4;
    }
  `;

  render() {
    if (!this.session) return html`<p>connecting…</p>`;
    const s = this.session;
    const currentActDef = ACTS.find((a) => a.id === s.currentAct);
    const participants = s.participants.filter((p) => p.role === 'participant');
    const bpm = bidsPerMinute(s, 60_000, this.tickNow);
    const silent = silentTeams(s, 60_000, this.tickNow);
    const ready = readyCount(s);
    const showReady = s.currentAct === 'scene' || s.currentAct === 'strategy';

    const availableValues = VALUES.filter((v) => s.valueDeck.includes(v.id));

    return html`
      <header>
        <img class="wordmark" src="/wordmark.svg" alt="winded.vertigo" />
        <div class="session-share" aria-label=${`session code ${this.code}`}>
          <div class="row">
            <span class="label">session</span>
            <span class="code-value">${this.code}</span>
            <div class="share-actions">
              <va-button
                size="sm"
                variant="ghost"
                aria-label="copy participant join link"
                @va-click=${() => this.copyLink('join')}
              >
                ${this.copied === 'join' ? 'copied' : 'copy join link'}
              </va-button>
              <va-button
                size="sm"
                variant="ghost"
                aria-label="copy wall display link"
                @va-click=${() => this.copyLink('wall')}
              >
                ${this.copied === 'wall' ? 'copied' : 'copy wall link'}
              </va-button>
            </div>
          </div>
          <span class="hint">share this code with your group — they join from the landing page, or open the join link directly.</span>
        </div>
      </header>

      <!-- left pane: timeline + act controls -->
      <aside class="panel">
        <h2>act timeline</h2>
        <va-act-timeline
          interactive
          .currentAct=${s.currentAct}
          @va-jump=${(e: CustomEvent<{ to: string }>) => this.confirmJump(e.detail.to)}
        ></va-act-timeline>
        ${this.pendingJump && this.pendingJump !== s.currentAct
          ? html`
              <div class="jump-confirm" role="alertdialog">
                ${COPY.facilitator.jumpConfirm}
                <div>
                  <va-button
                    variant="urgent"
                    size="sm"
                    @va-click=${() => this.confirmJump(this.pendingJump!)}
                    >${COPY.facilitator.continue}</va-button
                  >
                  <va-button
                    variant="ghost"
                    size="sm"
                    @va-click=${() => (this.pendingJump = null)}
                    >${COPY.facilitator.cancel}</va-button
                  >
                </div>
              </div>
            `
          : ''}
        <div class="actions">
          ${!s.startedAt
            ? html`<va-button variant="primary" @va-click=${() => this.startSession()}
                >${COPY.facilitator.startSession}</va-button
              >`
            : s.currentAct === 'regather'
              ? html`<p class="session-end-note" role="status">
                  ${COPY.facilitator.sessionComplete}
                </p>`
              : html`
                  <va-button variant="primary" @va-click=${() => this.advance()}
                    >${COPY.facilitator.nextAct}</va-button
                  >
                  <va-button variant="ghost" @va-click=${() => this.extend()}
                    >${COPY.facilitator.extend}</va-button
                  >
                  ${s.currentAct === 'scene'
                    ? html`<va-button variant="secondary" @va-click=${() => this.goBack()}
                        >${COPY.facilitator.goBack}</va-button
                      >`
                    : ''}
                `}
        </div>
        ${s.actStartedAt
          ? html`<div style="margin-top: var(--space-3)">
              <va-countdown
                .startedAt=${s.actStartedAt}
                .durationMs=${s.actDurationMs}
              ></va-countdown>
              <span style="margin-left: var(--space-2); color: var(--fg-muted);"
                >${currentActDef?.name}</span
              >
            </div>`
          : ''}
      </aside>

      <!-- centre: live signal + broadcast -->
      <section>
        <div class="panel signal">
          <h2>${COPY.facilitator.liveSignal}</h2>
          <dl>
            <dt>participants</dt>
            <dd>${participants.length}</dd>
            <dt>teams formed</dt>
            <dd>${s.teams.length}</dd>
            ${showReady
              ? html`
                  <dt>ready</dt>
                  <dd>${ready} / ${participants.length}</dd>
                `
              : ''}
            <dt>bids / min</dt>
            <dd>${bpm}</dd>
            <dt>values remaining</dt>
            <dd>${s.valueDeck.length}</dd>
            <dt>auctions complete</dt>
            <dd>${s.completedAuctions.length}</dd>
          </dl>
        </div>

        <div class="panel" style="margin-top: var(--space-4);">
          <h2>teams</h2>
          <div class="team-list">
            ${s.teams.map(
              (t) => html`
                <div class="team-row">
                  <span>
                    <span class="colour" style=${`background: var(--team-${t.colour})`}></span>
                    ${t.name}
                  </span>
                  <span>${t.credos} credos</span>
                  <va-button
                    size="sm"
                    variant="ghost"
                    @va-click=${() =>
                      this.muteTeam(t.id, !s.mutedTeamIds.includes(t.id))}
                    >${s.mutedTeamIds.includes(t.id) ? 'unmute' : 'mute'}</va-button
                  >
                </div>
              `,
            )}
          </div>
          ${silent.length > 0 && s.currentAct === 'auction'
            ? html`<p style="margin-top: var(--space-3); color: var(--wv-redwood)">
                quiet: ${silent.map((t) => t.name).join(', ')}
              </p>`
            : ''}
        </div>

        <div class="panel" style="margin-top: var(--space-4);">
          <h2>broadcast</h2>
          <label for="bc-input" class="sr-only">${COPY.facilitator.broadcastLabel}</label>
          <input
            id="bc-input"
            type="text"
            .value=${this.broadcastDraft}
            @input=${(e: Event) =>
              (this.broadcastDraft = (e.target as HTMLInputElement).value)}
            placeholder="one sentence to all participants..."
          />
          <va-button variant="primary" @va-click=${() => this.broadcast()}>
            ${COPY.facilitator.broadcastSend}
          </va-button>
        </div>
      </section>

      <!-- right: deck + auction control + tools (or session close on regather) -->
      <aside class="panel">
        ${s.currentAct === 'regather'
          ? html`
              <h2>${COPY.facilitator.closeHeading}</h2>
              <p style="color: var(--fg-muted); line-height: 1.5; margin-bottom: var(--space-4);">
                ${COPY.facilitator.closeBody}
              </p>
              <va-button
                variant="primary"
                ?disabled=${s.teams.length === 0}
                @va-click=${() => this.downloadAllCards()}
              >
                ${COPY.facilitator.downloadAll(s.teams.length)}
              </va-button>
            `
          : html`
              <h2>${COPY.facilitator.deckLabel}</h2>
              ${s.currentAuction
                ? html`
                    <div style="display: flex; justify-content: center; margin-bottom: var(--space-4);">
                      <va-countdown
                        ring
                        announceSeconds
                        .startedAt=${s.currentAuction.startedAt}
                        .durationMs=${s.currentAuction.durationMs}
                      ></va-countdown>
                    </div>
                  `
                : ''}
              <ol class="deck-steps">
                <li data-done=${this.nextValueId ? true : null}>
                  ${COPY.facilitator.deckStep1}
                </li>
                <li
                  data-done=${this.nextValueId && s.currentAct === 'auction' ? true : null}
                >
                  ${COPY.facilitator.deckStep2}
                </li>
                <li data-done=${s.currentAuction ? true : null}>
                  ${COPY.facilitator.deckStep3}
                </li>
              </ol>
              <div class="deck">
                ${availableValues.map(
                  (v) => html`
                    <button
                      type="button"
                      data-selected=${this.nextValueId === v.id}
                      @click=${() => (this.nextValueId = v.id)}
                    >
                      ${v.name}
                    </button>
                  `,
                )}
                ${availableValues.length === 0
                  ? html`<p style="color: var(--fg-muted)">deck empty.</p>`
                  : ''}
              </div>
              <div class="actions">
                ${!s.currentAuction
                  ? html`<va-button
                      variant="urgent"
                      ?disabled=${!this.nextValueId || s.currentAct !== 'auction'}
                      @va-click=${() => this.startAuction()}
                    >
                      ${COPY.facilitator.startAuction}
                    </va-button>`
                  : html`<va-button variant="ghost" @va-click=${() => this.endAuction()}
                      >end auction</va-button
                    >`}
              </div>
              ${this.nextValueId && s.currentAct !== 'auction'
                ? html`<p class="deck-warning" role="status">
                    ${COPY.facilitator.deckNotInAuction}
                  </p>`
                : ''}

              <div class="tools">
                <h2>${COPY.facilitator.tools}</h2>
                <va-button
                  size="sm"
                  variant="ghost"
                  ?disabled=${!s.currentAuction}
                  @va-click=${() => this.resetBid()}
                  >${COPY.facilitator.resetBid}</va-button
                >
              </div>
            `}
      </aside>
    `;
  }
}
