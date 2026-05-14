import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { VALUES } from '@/content/values';
import { COPY } from '@/content/copy';
import type { IntentionZone, Team } from '@/state/types';
import { plannedSpend } from '@/state/selectors';
import { STARTING_CREDOS } from '@/state/reducers';
import './value-card';
import './poll-buttons';

type Zone = 'deck' | 'must' | 'nice' | 'wont';

@customElement('va-strategy-board')
export class VaStrategyBoard extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: String }) participantId = '';
  /** filter out values that have already been auctioned (for restrategize). */
  @property({ type: Array }) remainingValueIds: string[] | null = null;

  @state() private focusedValueId: string | null = null;
  @state() private dragOverZone: Zone | null = null;
  @state() private draggingValueId: string | null = null;

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    .hint {
      color: var(--fg-muted);
      margin-bottom: var(--space-4);
    }
    .planned {
      margin-bottom: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--bg-card);
      border-radius: var(--radius-sm);
      font: var(--type-small);
      color: var(--fg);
    }
    .planned[data-over] {
      border-left: 3px solid var(--wv-redwood);
      color: var(--accent-emphasis);
      font-weight: 700;
    }
    /* mobile-first: priority zones (must/nice) top, secondary (wont/deck) below */
    .board {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .priority-zones {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    @media (min-width: 640px) {
      .priority-zones {
        gap: var(--space-4);
      }
    }
    .secondary-zones {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    @media (min-width: 640px) {
      .secondary-zones {
        gap: var(--space-4);
      }
    }
    @media (min-width: 1024px) {
      .board {
        display: grid;
        grid-template-columns: 1fr;
      }
      .priority-zones,
      .secondary-zones {
        grid-template-columns: 1fr 1fr;
      }
    }
    .zone {
      background: var(--bg-spotlight);
      border: 2px dashed rgba(39, 50, 72, 0.25);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      min-height: 120px;
      transition:
        border-color var(--dur-base) var(--ease-out-quart),
        background var(--dur-base) var(--ease-out-quart);
    }
    @media (min-width: 640px) {
      .zone {
        padding: var(--space-4);
        min-height: 200px;
      }
    }
    /* secondary zones are compact on mobile */
    .secondary-zones .zone {
      min-height: 80px;
    }
    @media (min-width: 640px) {
      .secondary-zones .zone {
        min-height: 140px;
      }
    }
    .zone h3 {
      font: var(--type-h2);
      margin-bottom: var(--space-2);
      text-transform: lowercase;
    }
    @media (max-width: 479px) {
      .zone h3 {
        font-size: 16px;
        margin-bottom: var(--space-2);
      }
    }
    .zone[data-zone='must'] {
      border-color: var(--accent-emphasis);
    }
    .zone[data-zone='nice'] {
      border-color: var(--wv-burnt-sienna);
    }
    .zone[data-drag-over] {
      border-style: solid;
      background: var(--bg-spotlight);
    }
    .zone ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    @media (min-width: 640px) {
      .zone ul {
        gap: var(--space-3);
      }
    }
    .zone li {
      cursor: grab;
      list-style: none;
    }
    .zone li[data-dragging] {
      cursor: grabbing;
    }
    .zone li:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
      border-radius: var(--radius-md);
    }
    .keyboard-hint {
      display: inline-block;
      background: var(--bg-card);
      border: 1px solid rgba(39, 50, 72, 0.15);
      color: var(--fg-muted);
      font: var(--type-small);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      margin-top: var(--space-3);
    }
    .keyboard-hint kbd {
      display: inline-block;
      padding: 0 var(--space-1);
      border: 1px solid rgba(39, 50, 72, 0.35);
      border-radius: 3px;
      font: var(--type-mono);
      font-size: 12px;
      color: var(--fg);
      background: var(--bg);
      margin: 0 1px;
    }
  `;

  private isCaptain(): boolean {
    return Boolean(this.team?.captainParticipantId) &&
      this.team!.captainParticipantId === this.participantId;
  }

  private valuesInScope() {
    if (this.remainingValueIds) {
      const set = new Set(this.remainingValueIds);
      return VALUES.filter((v) => set.has(v.id));
    }
    return VALUES;
  }

  private zoneForValue(id: string): Zone {
    const z = this.team?.intentions[id];
    if (z === 'must' || z === 'nice' || z === 'wont') return z;
    return 'deck';
  }

  private setZone(valueId: string, zone: IntentionZone) {
    if (!this.team) return;
    this.dispatchEvent(
      new CustomEvent('va-intention', {
        detail: { teamId: this.team.id, valueId, zone },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onKey(e: KeyboardEvent, valueId: string) {
    const key = e.key.toLowerCase();
    if (key === 'm') this.setZone(valueId, 'must');
    else if (key === 'n') this.setZone(valueId, 'nice');
    else if (key === 'w') this.setZone(valueId, 'wont');
    else if (key === 'd') this.setZone(valueId, null);
    else return;
    e.preventDefault();
  }

  private onDragStart(e: DragEvent, valueId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', valueId);
    e.dataTransfer.effectAllowed = 'move';
    this.draggingValueId = valueId;
  }

  private onDragEnd() {
    this.draggingValueId = null;
    this.dragOverZone = null;
  }

  private onDragOver(e: DragEvent, zone: Zone) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (this.dragOverZone !== zone) this.dragOverZone = zone;
  }

  private onDragLeave(e: DragEvent, zone: Zone) {
    const next = e.relatedTarget as Node | null;
    const current = e.currentTarget as HTMLElement;
    if (next && current.contains(next)) return;
    if (this.dragOverZone === zone) this.dragOverZone = null;
  }

  private onDrop(e: DragEvent, zone: Zone) {
    e.preventDefault();
    const valueId = e.dataTransfer?.getData('text/plain') ?? this.draggingValueId;
    this.dragOverZone = null;
    this.draggingValueId = null;
    if (!valueId) return;
    if (this.zoneForValue(valueId) === zone) return;
    this.setZone(valueId, zone === 'deck' ? null : zone);
  }

  private renderZone(
    zone: Zone,
    inScope: ReturnType<typeof this.valuesInScope>,
    labels: Record<Zone, string>,
    captain: boolean,
  ) {
    return html`
      <section
        class="zone"
        data-zone=${zone}
        data-drag-over=${this.dragOverZone === zone ? true : null}
        aria-label=${labels[zone]}
        @dragover=${(e: DragEvent) => this.onDragOver(e, zone)}
        @dragenter=${(e: DragEvent) => this.onDragOver(e, zone)}
        @dragleave=${(e: DragEvent) => this.onDragLeave(e, zone)}
        @drop=${(e: DragEvent) => this.onDrop(e, zone)}
      >
        <h3>${labels[zone]}</h3>
        <ul>
          ${inScope
            .filter((v) => this.zoneForValue(v.id) === zone)
            .map(
              (v) => html`
                <li
                  tabindex="0"
                  draggable="true"
                  data-dragging=${this.draggingValueId === v.id ? true : null}
                  @dragstart=${(e: DragEvent) => this.onDragStart(e, v.id)}
                  @dragend=${() => this.onDragEnd()}
                  @keydown=${(e: KeyboardEvent) => this.onKey(e, v.id)}
                  @focus=${() => (this.focusedValueId = v.id)}
                  aria-label=${`${v.name}. in ${labels[zone]}. drag to move, or press M, N, W, or D.`}
                >
                  <va-value-card
                    .value=${v}
                    .zone=${zone === 'deck' ? 'deck' : zone}
                  ></va-value-card>
                  ${zone === 'must' || zone === 'nice'
                    ? html`
                        <va-poll-buttons
                          .team=${this.team}
                          .valueId=${v.id}
                          .participantId=${this.participantId}
                          ?captain=${captain}
                        ></va-poll-buttons>
                      `
                    : ''}
                </li>
              `,
            )}
        </ul>
      </section>
    `;
  }

  render() {
    const zones: Zone[] = ['deck', 'must', 'nice', 'wont'];
    const labels: Record<Zone, string> = {
      deck: COPY.strategy.deckLabel,
      must: COPY.strategy.zones.must,
      nice: COPY.strategy.zones.nice,
      wont: COPY.strategy.zones.wont,
    };
    const inScope = this.valuesInScope();
    const captain = this.isCaptain();
    const planned = this.team ? plannedSpend(this.team) : 0;
    const budget = this.team?.credos ?? STARTING_CREDOS;
    const over = planned > budget;
    return html`
      <p class="hint">${COPY.strategy.prompt}</p>
      ${this.team
        ? html`
            <div class="planned" data-over=${over ? true : null} aria-live="polite">
              ${COPY.strategy.plannedSpend(planned, budget)}
              ${over ? html` <span>${COPY.strategy.plannedSpendOver}</span>` : ''}
            </div>
          `
        : ''}
      <div class="board">
        <div class="priority-zones">
          ${(['must', 'nice'] as Zone[]).map((zone) => this.renderZone(zone, inScope, labels, captain))}
        </div>
        <div class="secondary-zones">
          ${(['deck', 'wont'] as Zone[]).map((zone) => this.renderZone(zone, inScope, labels, captain))}
        </div>
      </div>
      <p class="keyboard-hint" aria-label=${COPY.strategy.keyboardHint}>
        keyboard:
        <kbd>M</kbd> must ·
        <kbd>N</kbd> nice ·
        <kbd>W</kbd> won’t ·
        <kbd>D</kbd> deck
      </p>
    `;
  }
}
