import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Controller } from '@/state/controller';
import type { Session } from '@/state/types';
import { COPY } from '@/content/copy';
import { ACTS } from '@/content/acts';
import { VALUES } from '@/content/values';
import {
  DEFAULT_AUCTION_MS,
  PRACTICE_AUCTION_MS,
  advanceAct,
  assignTeams,
} from '@/state/reducers';
import { prevAct } from '@/content/acts';
import {
  bidsPerMinute,
  brainstormSubmittedCount,
  decidedCount,
  readyCount,
  silentTeams,
  totalParticipants,
  visibleBrainstorm,
} from '@/state/selectors';
import { startTicker } from '@/utils/timer';
import '@/components/va-card';
import '@/components/va-button';
import '@/components/credos-stack';
import '@/components/countdown';
import '@/components/act-timeline';
import '@/components/value-card';
import '@/views/participant';

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
  /**
   * captain-reassigned toasts. each disconnect-driven transfer surfaces
   * a transient warning so the facilitator knows a team's submitter
   * changed mid-session.
   */
  @state() private captainAlerts: Array<{
    id: string;
    teamId: string;
    teamName: string;
    captainName: string;
    at: number;
  }> = [];
  /**
   * controls the embedded participant-view preview so facilitators can see
   * exactly what the breakouts see without opening a second tab.
   */
  @state() private previewOpen = false;
  @state() private previewSize: 'mobile' | 'tablet' | 'full' = 'mobile';

  private unsub?: () => void;
  private ticker: { stop(): void } | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCaptainEventAt = 0;
  private captainAlertTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
      this.unsub = this.controller.store.subscribe((s) => {
        this.session = s;
        this.watchCaptainEvents(s);
      });
      this.session = this.controller.store.getState();
      this.lastCaptainEventAt = this.session.events
        .filter((e) => e.type === 'captainTransferred')
        .reduce((m, e) => Math.max(m, e.at), 0);
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
    for (const t of this.captainAlertTimers.values()) clearTimeout(t);
    this.captainAlertTimers.clear();
  }

  /**
   * surface a transient alert when a captain is auto-reassigned mid-session
   * (disconnect grace period elapsed). manual passes aren't surfaced — those
   * were intentional. each alert auto-dismisses after 12s.
   */
  private watchCaptainEvents(s: Session) {
    const fresh = s.events.filter(
      (e) =>
        e.type === 'captainTransferred' &&
        e.at > this.lastCaptainEventAt &&
        (e.payload as { reason?: string }).reason === 'disconnect',
    );
    if (fresh.length === 0) return;
    this.lastCaptainEventAt = fresh.reduce(
      (m, e) => Math.max(m, e.at),
      this.lastCaptainEventAt,
    );
    const nextAlerts = [...this.captainAlerts];
    for (const ev of fresh) {
      const payload = ev.payload as { teamId: string; to: string };
      const team = s.teams.find((t) => t.id === payload.teamId);
      const captain = s.participants.find((p) => p.id === payload.to);
      if (!team || !captain) continue;
      const alertId = ev.id;
      nextAlerts.push({
        id: alertId,
        teamId: team.id,
        teamName: team.name,
        captainName: captain.displayName,
        at: ev.at,
      });
      const timer = setTimeout(() => {
        this.captainAlerts = this.captainAlerts.filter((a) => a.id !== alertId);
        this.captainAlertTimers.delete(alertId);
      }, 12_000);
      this.captainAlertTimers.set(alertId, timer);
    }
    this.captainAlerts = nextAlerts;
  }

  private dismissCaptainAlert(alertId: string) {
    this.captainAlerts = this.captainAlerts.filter((a) => a.id !== alertId);
    const t = this.captainAlertTimers.get(alertId);
    if (t) {
      clearTimeout(t);
      this.captainAlertTimers.delete(alertId);
    }
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

  private togglePause() {
    if (!this.session) return;
    const at = Date.now();
    if (this.session.actPausedAt) {
      this.controller?.dispatch({ type: 'ACT_RESUME', at });
    } else {
      this.controller?.dispatch({ type: 'ACT_PAUSE', at });
    }
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

  private startPractice() {
    this.controller?.dispatch({
      type: 'PRACTICE_START',
      durationMs: PRACTICE_AUCTION_MS,
      at: Date.now(),
    });
  }

  private endPractice() {
    this.controller?.dispatch({ type: 'PRACTICE_END', at: Date.now() });
  }

  private triggerRestrategize() {
    this.controller?.dispatch({
      type: 'ACT_ADVANCE',
      to: 'restrategize',
      at: Date.now(),
    });
  }

  private resumeAuction() {
    this.controller?.dispatch({
      type: 'ACT_ADVANCE',
      to: 'auction',
      at: Date.now(),
    });
  }

  private hideBrainstorm(responseId: string) {
    if (!confirm(COPY.brainstorm.facilitatorHideConfirm)) return;
    this.controller?.dispatch({ type: 'BRAINSTORM_HIDE', responseId });
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
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .preview-hint {
      color: var(--fg-muted);
      font: var(--type-small);
      margin: 0;
      line-height: 1.4;
      flex: 1 1 auto;
    }
    .preview-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
      margin: var(--space-2) 0 var(--space-3);
    }
    /*
     * the participant preview is mounted inline so it shares the controller
     * for live state. we put it in a containment context so its internal
     * media queries respond to the panel width rather than the viewport,
     * giving an honest mobile-feel preview without resorting to transform-
     * based scaling (which lies about layout and breaks pointer math).
     */
    .preview-frame {
      max-height: 640px;
      overflow: auto;
      border-radius: var(--radius-md);
      background: var(--bg);
      border: 1px solid rgba(39, 50, 72, 0.1);
      padding: var(--space-2);
      container-type: inline-size;
    }
    .preview-frame va-participant {
      pointer-events: none;
      display: block;
      /* clamp the embedded view so participant content doesn't blow up the panel */
      max-width: 100%;
      font-size: 14px;
    }
    .preview-size-toggle {
      display: inline-flex;
      gap: var(--space-2);
      margin-left: auto;
      font: var(--type-small);
    }
    .preview-size-toggle button {
      padding: 4px var(--space-2);
      border-radius: var(--radius-sm);
      border: 1px solid rgba(39, 50, 72, 0.2);
      background: var(--bg);
      color: var(--fg);
      cursor: pointer;
      font: var(--type-small);
      font-weight: 700;
    }
    .preview-size-toggle button[data-active] {
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      border-color: var(--wv-cadet-blue);
    }
    .preview-frame[data-size='mobile'] {
      max-width: 380px;
      margin: 0 auto;
    }
    .preview-frame[data-size='tablet'] {
      max-width: 720px;
      margin: 0 auto;
    }
    .captain-alerts {
      position: fixed;
      right: var(--space-5);
      bottom: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      z-index: 20;
      max-width: 360px;
    }
    .captain-alert {
      background: var(--wv-redwood);
      color: var(--fg-inverse);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
      animation: va-spring-pulse var(--dur-base) var(--ease-spring);
    }
    .captain-alert .label {
      font: var(--type-small);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.8;
      display: block;
      margin-bottom: 2px;
    }
    .captain-alert .body {
      flex: 1;
      line-height: 1.4;
    }
    .captain-alert button {
      background: transparent;
      color: var(--fg-inverse);
      border: 0;
      cursor: pointer;
      font-weight: 700;
      font-size: 16px;
      padding: 0;
      line-height: 1;
    }
  `;

  /**
   * inline participant-view preview. shares the same controller as the
   * facilitator, so it stays in sync without a second device or tab.
   * dispatches from the preview are no-ops (see va-participant's `preview`
   * prop) so the facilitator can't accidentally bid or vote.
   */
  private renderParticipantPreview() {
    return html`
      <div class="panel" style="margin-top: var(--space-4);">
        <div class="preview-header">
          <h2>participant preview</h2>
          <va-button
            size="sm"
            variant="ghost"
            aria-expanded=${this.previewOpen ? 'true' : 'false'}
            @va-click=${() => (this.previewOpen = !this.previewOpen)}
          >
            ${this.previewOpen ? 'hide' : 'show'} participant view
          </va-button>
        </div>
        ${this.previewOpen
          ? html`
              <div class="preview-meta">
                <p class="preview-hint">
                  read-only mirror of what one of your participants sees right now.
                  updates live as you advance acts.
                </p>
                <div class="preview-size-toggle" role="group" aria-label="preview width">
                  ${(['mobile', 'tablet', 'full'] as const).map(
                    (size) => html`
                      <button
                        type="button"
                        data-active=${this.previewSize === size ? true : null}
                        aria-pressed=${this.previewSize === size ? 'true' : 'false'}
                        @click=${() => (this.previewSize = size)}
                      >
                        ${size}
                      </button>
                    `,
                  )}
                </div>
              </div>
              <div class="preview-frame" data-size=${this.previewSize}>
                <va-participant
                  preview
                  .controller=${this.controller}
                  .code=${this.code}
                ></va-participant>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private renderCaptainAlerts() {
    if (this.captainAlerts.length === 0) return html``;
    return html`
      <div class="captain-alerts" role="region" aria-label="captain reassignments">
        ${this.captainAlerts.map(
          (a) => html`
            <div class="captain-alert" role="status">
              <div class="body">
                <span class="label">team ${a.teamName} — captain reassigned</span>
                <span>${a.captainName} took over after the previous captain went silent.</span>
              </div>
              <button
                type="button"
                aria-label="dismiss"
                @click=${() => this.dismissCaptainAlert(a.id)}
              >
                ✕
              </button>
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderActSpecificPanel(s: Session) {
    if (s.currentAct === 'brainstorm') {
      const responded = brainstormSubmittedCount(s);
      const total = totalParticipants(s);
      const responses = visibleBrainstorm(s);
      return html`
        <div class="panel" style="margin-top: var(--space-4);">
          <h2>brainstorm wall</h2>
          <p style="color: var(--fg-muted); margin-bottom: var(--space-3); font-size: 14px;">
            ${COPY.brainstorm.counter(responded, total)}
          </p>
          <div
            style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-2);"
          >
            ${responses.length === 0
              ? html`<p style="color: var(--fg-muted)">${COPY.brainstorm.feedEmpty}</p>`
              : [...responses]
                  .sort((a, b) => b.at - a.at)
                  .map(
                    (r) => html`
                      <div
                        style="display: flex; justify-content: space-between; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg); border-radius: var(--radius-sm);"
                      >
                        <span style="line-height: 1.4; font-size: 14px;">${r.text}</span>
                        <button
                          type="button"
                          style="background: transparent; color: var(--wv-redwood); border: 0; font-size: 12px; cursor: pointer; font-weight: 700;"
                          @click=${() => this.hideBrainstorm(r.id)}
                        >
                          ${COPY.brainstorm.facilitatorHide}
                        </button>
                      </div>
                    `,
                  )}
          </div>
        </div>
      `;
    }
    if (s.currentAct === 'strategy') {
      return html`
        <div class="panel" style="margin-top: var(--space-4);">
          <h2>team consensus</h2>
          <div class="team-list">
            ${s.teams.map((t) => {
              const decided = decidedCount(t, s.valueDeck);
              const captain = s.participants.find(
                (p) => p.id === t.captainParticipantId,
              );
              return html`
                <div class="team-row">
                  <span>
                    <span
                      class="colour"
                      style=${`background: var(--team-${t.colour})`}
                    ></span>
                    ${t.name}
                  </span>
                  <span style="font-size: 13px; color: var(--fg-muted)">
                    ${decided}/${s.valueDeck.length} locked
                    ·
                    ${captain ? `captain: ${captain.displayName}` : 'no captain'}
                  </span>
                </div>
              `;
            })}
          </div>
        </div>
      `;
    }
    if (s.currentAct === 'restrategize') {
      return html`
        <div class="panel" style="margin-top: var(--space-4);">
          <h2>restrategize progress</h2>
          <p style="color: var(--fg-muted); font-size: 14px; margin-bottom: var(--space-3);">
            teams are revising votes with results visible. resume when the room is ready.
          </p>
          <div class="team-list">
            ${s.teams.map((t) => {
              const decided = decidedCount(t, s.valueDeck);
              return html`
                <div class="team-row">
                  <span>
                    <span
                      class="colour"
                      style=${`background: var(--team-${t.colour})`}
                    ></span>
                    ${t.name}
                  </span>
                  <span style="font-size: 13px; color: var(--fg-muted)">
                    ${t.credos} credos left · ${decided}/${s.valueDeck.length} relocked
                  </span>
                </div>
              `;
            })}
          </div>
          <div class="actions">
            <va-button variant="urgent" @va-click=${() => this.resumeAuction()}>
              ${COPY.restrategize.resumeCta}
            </va-button>
          </div>
        </div>
      `;
    }
    return html``;
  }

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
      ${this.renderCaptainAlerts()}
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
                  <va-button
                    variant="ghost"
                    aria-pressed=${s.actPausedAt ? 'true' : 'false'}
                    @va-click=${() => this.togglePause()}
                  >
                    ${s.actPausedAt ? 'resume timer' : 'pause timer'}
                  </va-button>
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
                .pausedAt=${s.actPausedAt ?? 0}
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

        ${this.renderActSpecificPanel(s)}

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

        ${this.renderParticipantPreview()}
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
          : s.currentAct === 'practice'
            ? html`
                <h2>${COPY.practice.label}</h2>
                <p style="color: var(--fg-muted); line-height: 1.5; margin-bottom: var(--space-3);">
                  ${COPY.practice.intro}
                </p>
                ${s.currentAuction
                  ? html`
                      <div style="display: flex; justify-content: center; margin-bottom: var(--space-3);">
                        <va-countdown
                          ring
                          announceSeconds
                          .startedAt=${s.currentAuction.startedAt}
                          .durationMs=${s.currentAuction.durationMs}
                        ></va-countdown>
                      </div>
                      <va-button variant="ghost" @va-click=${() => this.endPractice()}>
                        end practice round
                      </va-button>
                    `
                  : s.practiceCompleted
                    ? html`
                        <p style="margin-bottom: var(--space-3); font-weight: 700;">
                          practice complete. advance to the real auction when ready.
                        </p>
                        <va-button variant="urgent" @va-click=${() => this.advance()}>
                          ${COPY.practice.endCta}
                        </va-button>
                      `
                    : html`<va-button
                        variant="urgent"
                        @va-click=${() => this.startPractice()}
                      >
                        ${COPY.practice.startCta}
                      </va-button>`}
              `
            : s.currentAct === 'auction'
              ? html`
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
                    <li data-done=${this.nextValueId ? true : null}>
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
                          ?disabled=${!this.nextValueId}
                          @va-click=${() => this.startAuction()}
                        >
                          ${COPY.facilitator.startAuction}
                        </va-button>`
                      : html`<va-button variant="ghost" @va-click=${() => this.endAuction()}
                          >end auction</va-button
                        >`}
                  </div>
                  <div class="tools">
                    <h2>${COPY.facilitator.tools}</h2>
                    <va-button
                      size="sm"
                      variant="ghost"
                      ?disabled=${!s.currentAuction}
                      @va-click=${() => this.resetBid()}
                      >${COPY.facilitator.resetBid}</va-button
                    >
                    <va-button
                      size="sm"
                      variant="urgent"
                      ?disabled=${Boolean(s.currentAuction) || s.completedAuctions.filter((a) => !a.practice).length === 0}
                      @va-click=${() => this.triggerRestrategize()}
                    >
                      ${COPY.restrategize.facilitatorTriggerCta}
                    </va-button>
                  </div>
                `
              : html`
                  <h2>${COPY.facilitator.deckLabel}</h2>
                  <p
                    style="color: var(--fg-muted); line-height: 1.5; margin-bottom: var(--space-3); font-size: 14px;"
                  >
                    advance to the auction act to start bidding. queue a value here so
                    you're ready when participants regroup.
                  </p>
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
                  ${this.nextValueId
                    ? html`<p class="deck-warning" role="status">
                        ${COPY.facilitator.deckNotInAuction}
                      </p>`
                    : ''}
                `}
      </aside>
    `;
  }
}
