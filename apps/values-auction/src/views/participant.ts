import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Controller } from '@/state/controller';
import type { Broadcast, Session, Team } from '@/state/types';
import { COPY } from '@/content/copy';
import { teamForParticipant } from '@/state/selectors';
import { uid } from '@/utils/id';
import { announce } from '@/utils/a11y';
import '@/components/va-card';
import '@/components/va-button';
import '@/components/credos-stack';
import '@/components/countdown';
import '@/components/company-card';
import '@/components/strategy-board';
import '@/components/value-card';
import '@/components/bid-button';
import '@/components/identity-card';
import { VALUES, getValue } from '@/content/values';

@customElement('va-participant')
export class VaParticipant extends LitElement {
  @property({ attribute: false }) controller?: Controller;
  @property({ type: String }) code = 'DEMO';

  @state() private session?: Session;
  @state() private participantId = '';
  @state() private name = '';
  @state() private joined = false;
  @state() private welcomed = false;
  @state() private currentPrompt = 0;
  @state() private reflectionDraft: Record<number, string> = {};
  @state() private outbidPulseAt = 0;
  @state() private latestBroadcast?: Broadcast;
  @state() private dismissedBroadcastIds = new Set<string>();
  @state() private stageStep = 0;
  @state() private staged = false;
  @state() private reflectionSubmitted = false;
  private unsub?: () => void;
  private lastBidSeen = 0;
  private lastHighTeamId?: string;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.participantId = this.restoreOrCreateId();
    this.unsub = this.controller?.store.subscribe((s) => {
      this.session = s;
      this.reactToSession(s);
    });
    this.session = this.controller?.store.getState();
    const cachedName = sessionStorage.getItem(`va:name:${this.code}`);
    if (cachedName) {
      this.name = cachedName;
      this.joined = this.session?.participants.some((p) => p.id === this.participantId) ?? false;
    }
    this.staged = sessionStorage.getItem(`va:staged:${this.code}`) === '1';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
  }

  private restoreOrCreateId(): string {
    const key = `va:pid:${this.code}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = uid('p');
    sessionStorage.setItem(key, id);
    return id;
  }

  private reactToSession(s: Session) {
    const auction = s.currentAuction;
    if (auction?.highBid && auction.highBid.at > this.lastBidSeen) {
      const myTeam = teamForParticipant(s, this.participantId);
      const previousHighTeamId = this.lastHighTeamId;
      this.lastBidSeen = auction.highBid.at;
      this.lastHighTeamId = auction.highBid.teamId;
      const team = s.teams.find((t) => t.id === auction.highBid?.teamId);
      if (team) announce(`high bid: ${auction.highBid.amount} credos, ${team.name}.`, 'assertive');
      // outbid pulse: my team WAS the high bidder, and someone else just bid higher.
      if (
        myTeam &&
        previousHighTeamId === myTeam.id &&
        auction.highBid.teamId !== myTeam.id
      ) {
        this.outbidPulseAt = auction.highBid.at;
        announce(COPY.auction.outbid, 'assertive');
      }
    }
    // surface most recent broadcast that hasn't been dismissed yet.
    const latest = s.broadcasts[s.broadcasts.length - 1];
    if (latest && latest.id !== this.latestBroadcast?.id && !this.dismissedBroadcastIds.has(latest.id)) {
      this.latestBroadcast = latest;
      announce(`facilitator: ${latest.message}`, 'assertive');
      if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
      this.broadcastTimer = setTimeout(() => {
        if (this.latestBroadcast?.id === latest.id) {
          this.dismissedBroadcastIds.add(latest.id);
          this.latestBroadcast = undefined;
        }
      }, 12_000);
    }
  }

  private dismissBroadcast() {
    if (this.latestBroadcast) {
      this.dismissedBroadcastIds.add(this.latestBroadcast.id);
      this.latestBroadcast = undefined;
    }
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
  }

  private get team(): Team | undefined {
    if (!this.session) return undefined;
    return teamForParticipant(this.session, this.participantId);
  }

  private handleJoin(e: Event) {
    e.preventDefault();
    if (!this.name.trim() || !this.controller) return;
    sessionStorage.setItem(`va:name:${this.code}`, this.name.trim());
    this.controller.dispatch({
      type: 'PARTICIPANT_JOIN',
      participant: {
        id: this.participantId,
        displayName: this.name.trim(),
        teamId: null,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        role: 'participant',
      },
    });
    this.joined = true;
  }

  private advanceStage() {
    const total = COPY.staging.panels.length;
    if (this.stageStep < total - 1) {
      this.stageStep += 1;
      const next = COPY.staging.panels[this.stageStep];
      if (next) announce(`${next.heading} ${next.body}`, 'polite');
      return;
    }
    this.staged = true;
    sessionStorage.setItem(`va:staged:${this.code}`, '1');
    announce(COPY.arrival.waitingForFacilitator, 'polite');
  }

  private selectArchetype(archetype: 'builder' | 'diplomat' | 'rebel' | 'steward') {
    this.controller?.dispatch({
      type: 'ARCHETYPE_SELECT',
      participantId: this.participantId,
      archetype,
    });
  }

  private markReady() {
    if (!this.controller) return;
    const me = this.session?.participants.find((p) => p.id === this.participantId);
    const next = !(me?.ready ?? false);
    this.controller.dispatch({
      type: 'PARTICIPANT_READY',
      participantId: this.participantId,
      ready: next,
    });
    if (next) announce('marked ready.', 'polite');
  }

  private writeReflectionAnswer(index: number, answer: string) {
    this.reflectionDraft = { ...this.reflectionDraft, [index]: answer };
    if (!this.team) return;
    this.controller?.dispatch({
      type: 'REFLECTION_ANSWER',
      teamId: this.team.id,
      index,
      answer,
    });
  }

  private onBid(e: CustomEvent<{ amount: number }>) {
    if (!this.team) return;
    this.controller?.dispatch({
      type: 'BID_PLACE',
      teamId: this.team.id,
      amount: e.detail.amount,
      at: Date.now(),
    });
  }

  private onIntention = (e: CustomEvent) => {
    const detail = e.detail as { teamId: string; valueId: string; zone: any };
    this.controller?.dispatch({ type: 'INTENTION_SET', ...detail });
  };

  private onCeiling = (e: CustomEvent) => {
    const detail = e.detail as { teamId: string; valueId: string; amount: number };
    this.controller?.dispatch({ type: 'CEILING_SET', ...detail });
  };

  private writePurpose(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    if (!this.team) return;
    this.controller?.dispatch({
      type: 'PURPOSE_WRITE',
      teamId: this.team.id,
      statement: val,
    });
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      padding: var(--space-5);
      box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-6);
    }
    .wordmark {
      height: 32px;
    }
    .code {
      font: var(--type-mono);
      color: var(--fg-muted);
    }
    .stage {
      max-width: 880px;
      margin: 0 auto;
    }
    .arrival {
      text-align: center;
      padding-top: var(--space-7);
    }
    .arrival h1 {
      font: var(--type-display);
      margin-bottom: var(--space-3);
    }
    .arrival p {
      margin: 0 auto var(--space-5);
      color: var(--fg-muted);
    }
    .welcome-steps {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-width: 360px;
      margin: 0 auto var(--space-5);
      text-align: left;
    }
    .welcome-steps li {
      display: flex;
      gap: var(--space-2);
      color: var(--fg-muted);
    }
    .welcome-steps li::before {
      content: '—';
      color: var(--accent-warm);
      flex-shrink: 0;
    }
    .session-tag {
      display: inline-block;
      font: var(--type-mono);
      color: var(--fg-muted);
      margin-bottom: var(--space-5);
    }
    .session-tag strong {
      color: var(--fg);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .staging {
      max-width: 560px;
      margin: 0 auto;
      text-align: center;
      padding-top: var(--space-7);
    }
    .staging .step {
      font: var(--type-mono);
      color: var(--fg-muted);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      margin: 0 0 var(--space-4);
    }
    .staging h1 {
      font: var(--type-display);
      line-height: 1.15;
      margin: 0 0 var(--space-4);
    }
    .staging .body {
      color: var(--fg-muted);
      line-height: 1.6;
      margin: 0 auto var(--space-6);
      max-width: 48ch;
    }
    .staging .progress {
      display: flex;
      gap: var(--space-2);
      justify-content: center;
      margin-top: var(--space-6);
    }
    .staging .progress span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--wv-cadet-blue);
      opacity: 0.25;
      transition: opacity var(--dur-base) var(--ease-out-quart);
    }
    .staging .progress span[data-active] {
      opacity: 1;
    }
    form.join {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      align-items: center;
    }
    form.join input {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-pill);
      border: 2px solid var(--wv-cadet-blue);
      background: var(--bg-card);
      font: var(--type-body);
      min-width: 280px;
    }
    .waiting {
      display: flex;
      gap: var(--space-2);
      justify-content: center;
      margin-top: var(--space-5);
    }
    .waiting .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--wv-cadet-blue);
      animation: va-breathe 2s var(--ease-in-out) infinite;
    }
    .waiting .dot:nth-child(2) {
      animation-delay: 0.4s;
    }
    .waiting .dot:nth-child(3) {
      animation-delay: 0.8s;
    }
    .archetypes {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: 1fr;
    }
    @media (min-width: 720px) {
      .archetypes {
        grid-template-columns: 1fr 1fr;
      }
    }
    .archetype {
      padding: var(--space-5);
      cursor: pointer;
      border: 2px solid transparent;
      transition: all var(--dur-base) var(--ease-out-quart);
    }
    .archetype:focus-visible,
    .archetype:hover {
      border-color: var(--wv-cadet-blue);
      transform: translateY(-2px);
    }
    .archetype[data-active] {
      border-color: var(--wv-redwood);
      animation: va-spring-pulse var(--dur-base) var(--ease-spring);
    }
    .archetype h3 {
      font: var(--type-h2);
      margin-bottom: var(--space-2);
    }
    .auction-stage {
      text-align: center;
      padding: var(--space-5);
    }
    .auction-stage .high {
      margin-top: var(--space-4);
      font-weight: 700;
      font-size: 18px;
    }
    .auction-stage .high .colour-chip {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      margin-right: var(--space-2);
      vertical-align: middle;
    }
    .reflection {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .reflection textarea {
      width: 100%;
      min-height: 100px;
      border-radius: var(--radius-md);
      border: 2px solid var(--wv-cadet-blue);
      padding: var(--space-3);
      font: var(--type-body);
      resize: vertical;
    }
    .reflection-block {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) 0;
      border-top: 1px solid rgba(39, 50, 72, 0.12);
    }
    .reflection-block:first-of-type {
      border-top: 0;
    }
    .reflection-block label {
      font-weight: 700;
      color: var(--fg);
      line-height: 1.4;
    }
    .broadcast {
      position: sticky;
      top: var(--space-3);
      z-index: 5;
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      margin-bottom: var(--space-4);
    }
    .broadcast .label {
      font: var(--type-small);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.85;
      margin-bottom: var(--space-1);
    }
    .broadcast .message {
      font-weight: 700;
      line-height: 1.4;
    }
    .broadcast .body {
      flex: 1;
    }
    .broadcast button {
      background: transparent;
      color: var(--fg-inverse);
      border: 0;
      font: var(--type-body);
      font-weight: 700;
      cursor: pointer;
      padding: var(--space-1) var(--space-2);
    }
    .broadcast button:focus-visible {
      outline: 2px solid var(--fg-inverse);
      outline-offset: 2px;
    }
    .outbid-flash {
      animation: va-outbid-flash 1.2s var(--ease-out-quart);
    }
    @keyframes va-outbid-flash {
      0% { background: transparent; }
      20% { background: rgba(177, 80, 67, 0.25); transform: scale(1.02); }
      100% { background: transparent; transform: scale(1); }
    }
    .outbid-tag {
      display: inline-block;
      margin-top: var(--space-2);
      padding: var(--space-1) var(--space-3);
      background: var(--wv-redwood);
      color: var(--fg-inverse);
      font-weight: 700;
      border-radius: var(--radius-sm);
      animation: va-spring-pulse var(--dur-base) var(--ease-spring);
    }
    .out-of-credos {
      margin-top: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--bg-card);
      border: 2px dashed var(--wv-redwood);
      color: var(--wv-redwood);
      border-radius: var(--radius-md);
      font-weight: 700;
    }
    .ready-tag {
      display: inline-block;
      margin-left: var(--space-3);
      padding: var(--space-1) var(--space-3);
      background: var(--accent-warm, var(--wv-burnt-sienna));
      color: var(--fg-inverse);
      border-radius: var(--radius-pill);
      font: var(--type-small);
    }
    .late-join-note {
      margin-top: var(--space-4);
      padding: var(--space-3);
      background: var(--bg-card);
      border-left: 3px solid var(--wv-redwood);
      color: var(--fg);
    }
    .values-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
    }
    .values-list li {
      padding: var(--space-3);
      background: var(--bg-card);
      border-radius: var(--radius-sm);
      line-height: 1.5;
    }
    .values-list strong {
      color: var(--wv-cadet-blue);
    }
    .staging .values-preview {
      max-height: 50vh;
      overflow-y: auto;
      text-align: left;
      margin: 0 auto var(--space-6);
      padding-right: var(--space-2);
      scrollbar-width: thin;
    }
    .staging .values-preview .values-list li {
      font-size: 0.95rem;
    }
    .sector {
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid rgba(39, 50, 72, 0.15);
    }
    va-countdown {
      display: inline-block;
    }
  `;

  private renderArrival() {
    if (!this.welcomed && !this.joined) {
      return html`
        <section class="arrival fade-in">
          <h1>values auction.</h1>
          <p>
            you and your team will compete in a live auction for organisational values. every bid
            shapes the company you become.
          </p>
          <ul class="welcome-steps">
            <li>form a company and set your strategy</li>
            <li>bid for values in real time</li>
            <li>write your company’s purpose</li>
          </ul>
          <p class="session-tag">session <strong>${this.code}</strong></p>
          <va-button
            variant="primary"
            size="lg"
            @va-click=${() => (this.welcomed = true)}
          >
            enter the room
          </va-button>
        </section>
      `;
    }
    if (!this.joined) {
      return html`
        <section class="arrival fade-in">
          <h1>${COPY.arrival.heading}</h1>
          <p>${COPY.arrival.subheading}</p>
          <form class="join" @submit=${(e: Event) => this.handleJoin(e)}>
            <label for="name" class="sr-only">${COPY.arrival.nameLabel}</label>
            <input
              id="name"
              type="text"
              .value=${this.name}
              @input=${(e: Event) =>
                (this.name = (e.target as HTMLInputElement).value)}
              placeholder=${COPY.arrival.nameLabel}
              required
              autocomplete="name"
            />
            <va-button variant="primary" size="lg" @va-click=${(e: Event) => this.handleJoin(e)}>
              ${COPY.arrival.joinButton}
            </va-button>
          </form>
        </section>
      `;
    }
    if (!this.staged) {
      return this.renderStaging();
    }
    return html`
      <section class="arrival fade-in">
        <h1>you’re in, ${this.name}.</h1>
        <p>${COPY.arrival.waitingForFacilitator}</p>
        <div class="waiting" aria-hidden="true">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </section>
    `;
  }

  private renderStaging() {
    const panels = COPY.staging.panels;
    const total = panels.length;
    const idx = Math.min(this.stageStep, total - 1);
    const panel = panels[idx];
    if (!panel) return html``;
    const isLast = idx === total - 1;
    const buttonLabel = isLast ? COPY.staging.begin : COPY.staging.next;
    const showValues = 'showValues' in panel && panel.showValues === true;
    return html`
      <section
        class="staging fade-in"
        aria-label=${COPY.staging.progressLabel(idx + 1, total)}
      >
        <p class="step" aria-hidden="true">${panel.step} / ${String(total).padStart(2, '0')}</p>
        <h1>${panel.heading}</h1>
        <p class="body">${panel.body}</p>
        ${showValues
          ? html`
              <div class="values-preview">
                <ul class="values-list">
                  ${VALUES.map(
                    (v) => html`
                      <li>
                        <strong>${v.name}.</strong> <span>${v.description}</span>
                      </li>
                    `,
                  )}
                </ul>
              </div>
            `
          : ''}
        <va-button variant="primary" size="lg" @va-click=${() => this.advanceStage()}>
          ${buttonLabel}
        </va-button>
        <div class="progress" aria-hidden="true">
          ${panels.map(
            (_, i) => html`<span data-active=${i === idx ? true : null}></span>`,
          )}
        </div>
      </section>
    `;
  }

  private renderGrouping() {
    const me = this.session?.participants.find((p) => p.id === this.participantId);
    return html`
      <section class="fade-in">
        <h1>${COPY.grouping.heading}</h1>
        <p style="color: var(--fg-muted); margin-bottom: var(--space-3);">
          ${COPY.grouping.subheading}
        </p>
        <p style="color: var(--fg-muted); margin-bottom: var(--space-4); font-style: italic;">
          ${COPY.grouping.why}
        </p>
        <div class="archetypes" role="radiogroup" aria-label="archetype choice">
          ${COPY.grouping.options.map(
            (opt) => html`
              <va-card
                interactive
                class="archetype"
                role="radio"
                tabindex="0"
                aria-checked=${me?.archetype === opt.key}
                data-active=${me?.archetype === opt.key ? true : null}
                @click=${() => this.selectArchetype(opt.key)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectArchetype(opt.key);
                  }
                }}
              >
                <h3>${opt.key}</h3>
                <p>${opt.label}</p>
              </va-card>
            `,
          )}
        </div>
        ${this.team
          ? html`<p class="sector">${COPY.grouping.assigned(this.team.colour, 4)}</p>`
          : ''}
      </section>
    `;
  }

  private renderLateJoinerFallback() {
    if (!this.session) return html``;
    // teams already exist but we have no team — auto-assign should have caught this,
    // but if for some reason it didn't, surface a clear message.
    if (this.session.teams.length > 0) {
      return html`
        <section class="fade-in">
          <p class="late-join-note">${COPY.grouping.waitingForFacilitator}</p>
        </section>
      `;
    }
    return html`<p>waiting for a team assignment…</p>`;
  }

  private renderScene() {
    if (!this.team) return this.renderLateJoinerFallback();
    const me = this.session?.participants.find((p) => p.id === this.participantId);
    const isReady = me?.ready === true;
    return html`
      <section class="fade-in">
        ${this.renderCountdown()}
        <va-company-card .team=${this.team}></va-company-card>
        <div class="sector">
          <h2>${COPY.scene.valuesHeading}</h2>
          <p style="color: var(--fg-muted); margin-bottom: var(--space-3);">
            ${COPY.scene.valuesIntro}
          </p>
          <ul class="values-list">
            ${VALUES.map(
              (v) => html`
                <li>
                  <strong>${v.name}.</strong> <span>${v.description}</span>
                </li>
              `,
            )}
          </ul>
        </div>
        <div class="sector">
          <va-button
            variant=${isReady ? 'ghost' : 'primary'}
            @va-click=${() => this.markReady()}
            aria-pressed=${isReady}
          >
            ${isReady ? 'ready ✓ — tap to undo' : COPY.scene.ready}
          </va-button>
          ${isReady ? html`<span class="ready-tag">ready</span>` : ''}
        </div>
      </section>
    `;
  }

  private renderStrategy() {
    if (!this.team) return this.renderLateJoinerFallback();
    return html`
      <section class="fade-in">
        ${this.renderCountdown()}
        <va-strategy-board
          .team=${this.team}
          @va-intention=${this.onIntention}
          @va-ceiling=${this.onCeiling}
        ></va-strategy-board>
      </section>
    `;
  }

  private renderAuction() {
    const auction = this.session?.currentAuction;
    if (!auction) {
      return html`
        <section class="auction-stage fade-in">
          <h2>${COPY.auction.restrategise}</h2>
          <p>${COPY.auction.refundNeverHappens}</p>
        </section>
      `;
    }
    if (!this.team) return this.renderLateJoinerFallback();
    const v = getValue(auction.valueId);
    const highTeam = this.session?.teams.find((t) => t.id === auction.highBid?.teamId);
    const myTeamHasHigh = highTeam?.id === this.team.id;
    // pulse if outbid happened in the last ~2 seconds.
    const showOutbidPulse = this.outbidPulseAt > 0 && Date.now() - this.outbidPulseAt < 2000;
    const outOfCredos = this.team.credos <= 0;
    const stageClass = showOutbidPulse && !myTeamHasHigh ? 'auction-stage outbid-flash' : 'auction-stage';
    return html`
      <section class=${`${stageClass} fade-in`}>
        <va-value-card .value=${v} zone="must" large></va-value-card>
        <div style="margin-top: var(--space-4)">
          <va-countdown
            ring
            .startedAt=${auction.startedAt}
            .durationMs=${auction.durationMs}
            announceSeconds
          ></va-countdown>
        </div>
        <div class="high" aria-live="polite">
          ${auction.highBid && highTeam
            ? html`<span
                  class="colour-chip"
                  style=${`background: var(--team-${highTeam.colour})`}
                ></span
                >${highTeam.name}: ${auction.highBid.amount} credos`
            : COPY.auction.noBidsYet}
        </div>
        ${showOutbidPulse && !myTeamHasHigh
          ? html`<div class="outbid-tag" role="status">${COPY.auction.outbid}</div>`
          : ''}
        <div style="margin-top: var(--space-5)">
          <va-bid-button
            .currentHigh=${auction.highBid?.amount ?? 0}
            .credos=${this.team.credos}
            ?disabled=${outOfCredos}
            @va-bid=${(e: CustomEvent<{ amount: number }>) => this.onBid(e)}
          ></va-bid-button>
        </div>
        ${outOfCredos
          ? html`<div class="out-of-credos" role="status">${COPY.auction.outOfCredos}</div>`
          : ''}
      </section>
    `;
  }

  private renderReflection() {
    if (!this.team) return this.renderLateJoinerFallback();
    const prompts = COPY.reflection.prompts;
    if (this.reflectionSubmitted) {
      return html`
        <section class="reflection fade-in">
          <va-company-card .team=${this.team} showWon></va-company-card>
          <div class="sector">
            <h2>${COPY.reflection.submittedHeading}</h2>
            <p>${COPY.reflection.submittedBody}</p>
            <va-button
              variant="ghost"
              @va-click=${() => (this.reflectionSubmitted = false)}
              >${COPY.reflection.editAnswers}</va-button
            >
          </div>
        </section>
      `;
    }
    return html`
      <section class="reflection fade-in">
        <va-company-card .team=${this.team} showWon></va-company-card>
        ${prompts.map((prompt, idx) => {
          const id = `reflection-${idx}`;
          const value =
            this.reflectionDraft[idx] ??
            this.team!.reflectionAnswers[idx] ??
            '';
          return html`
            <div class="reflection-block">
              <label for=${id}>${prompt}</label>
              <textarea
                id=${id}
                placeholder=${COPY.reflection.answerPlaceholder}
                .value=${value}
                @input=${(e: Event) =>
                  this.writeReflectionAnswer(
                    idx,
                    (e.target as HTMLTextAreaElement).value,
                  )}
              ></textarea>
            </div>
          `;
        })}
        <div class="reflection-block">
          <label for="reflection-purpose">${COPY.reflection.purpose}</label>
          <textarea
            id="reflection-purpose"
            placeholder=${COPY.reflection.placeholder}
            .value=${this.team.purposeStatement ?? ''}
            @input=${(e: Event) => this.writePurpose(e)}
          ></textarea>
        </div>
        <div class="sector">
          <va-button variant="primary" @va-click=${() => this.submitReflection()}>
            ${COPY.reflection.submit}
          </va-button>
        </div>
      </section>
    `;
  }

  private submitReflection() {
    this.reflectionSubmitted = true;
    announce(COPY.reflection.ready, 'polite');
  }

  private renderRegather() {
    if (!this.team) return html``;
    return html`
      <section class="fade-in">
        <va-identity-card .team=${this.team}></va-identity-card>
        <div class="sector">
          <va-button
            variant="primary"
            @va-click=${() =>
              this.dispatchEvent(
                new CustomEvent('va-download-card', {
                  detail: { teamId: this.team?.id },
                  bubbles: true,
                  composed: true,
                }),
              )}
            >${COPY.regather.download}</va-button
          >
          <p style="margin-top: var(--space-4); color: var(--fg-muted);">
            ${COPY.regather.qr}
          </p>
        </div>
      </section>
    `;
  }

  private renderCountdown() {
    if (!this.session?.actStartedAt) return html``;
    const isStrategy = this.session.currentAct === 'strategy';
    return html`
      <div style="display: flex; justify-content: ${isStrategy ? 'center' : 'flex-end'}; margin-bottom: var(--space-3);">
        <va-countdown
          ?large=${isStrategy}
          .startedAt=${this.session.actStartedAt}
          .durationMs=${this.session.actDurationMs}
        ></va-countdown>
      </div>
    `;
  }

  private renderBroadcast() {
    if (!this.latestBroadcast) return html``;
    return html`
      <div class="broadcast" role="status" aria-live="polite">
        <div class="body">
          <div class="label">${COPY.broadcast.label}</div>
          <div class="message">${this.latestBroadcast.message}</div>
        </div>
        <button
          type="button"
          aria-label="dismiss broadcast"
          @click=${() => this.dismissBroadcast()}
        >
          ✕
        </button>
      </div>
    `;
  }

  render() {
    if (!this.session) return html`<p>loading…</p>`;
    const act = this.session.currentAct;
    let body;
    if (act === 'arrival') body = this.renderArrival();
    else if (act === 'grouping') body = this.renderGrouping();
    else if (act === 'scene') body = this.renderScene();
    else if (act === 'strategy') body = this.renderStrategy();
    else if (act === 'auction') body = this.renderAuction();
    else if (act === 'reflection') body = this.renderReflection();
    else body = this.renderRegather();

    return html`
      <header>
        <img class="wordmark" src="/wordmark.svg" alt="winded.vertigo" />
        <span class="code">${COPY.arrival.codeLabel}: ${this.code}</span>
      </header>
      <div class="stage">${this.renderBroadcast()}${body}</div>
    `;
  }
}
