import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { VALUES } from '@/content/values';
import { COPY } from '@/content/copy';
import type { IntentionZone, Team } from '@/state/types';
import './value-card';

type Zone = 'deck' | 'must' | 'nice' | 'wont';

@customElement('va-strategy-board')
export class VaStrategyBoard extends LitElement {
  @property({ type: Object }) team?: Team;

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
    .board {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
    @media (min-width: 900px) {
      .board {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    .zone {
      background: rgba(255, 255, 255, 0.55);
      border: 2px dashed rgba(39, 50, 72, 0.25);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      min-height: 240px;
      transition:
        border-color var(--dur-base) var(--ease-out-quart),
        background var(--dur-base) var(--ease-out-quart);
    }
    .zone h3 {
      font: var(--type-h2);
      margin-bottom: var(--space-3);
      text-transform: lowercase;
    }
    .zone[data-zone='must'] {
      border-color: var(--wv-redwood);
    }
    .zone[data-zone='nice'] {
      border-color: var(--wv-burnt-sienna);
    }
    .zone[data-drag-over] {
      border-style: solid;
      background: rgba(255, 235, 210, 0.6);
    }
    .zone ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .zone li {
      cursor: grab;
      list-style: none;
    }
    .zone li[data-dragging] {
      opacity: 0.4;
      cursor: grabbing;
    }
    .zone li:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
      border-radius: var(--radius-md);
    }
    .ceiling-input {
      margin-top: var(--space-2);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .ceiling-input input {
      width: 80px;
      padding: var(--space-1) var(--space-2);
      border: 1.5px solid var(--wv-cadet-blue);
      border-radius: var(--radius-sm);
      font: var(--type-small);
      font-weight: 700;
    }
    .ceiling-hint {
      color: var(--fg-muted);
      font: var(--type-small);
      font-style: italic;
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

  private setCeiling(valueId: string, amount: number) {
    if (!this.team) return;
    this.dispatchEvent(
      new CustomEvent('va-ceiling', {
        detail: { teamId: this.team.id, valueId, amount },
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

  render() {
    const zones: Zone[] = ['deck', 'must', 'nice', 'wont'];
    const labels: Record<Zone, string> = {
      deck: COPY.strategy.deckLabel,
      must: COPY.strategy.zones.must,
      nice: COPY.strategy.zones.nice,
      wont: COPY.strategy.zones.wont,
    };
    return html`
      <p class="hint">${COPY.strategy.prompt}</p>
      <div class="board">
        ${zones.map(
          (zone) => html`
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
                ${VALUES.filter((v) => this.zoneForValue(v.id) === zone).map(
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
                        .ceiling=${this.team?.softCeilings[v.id] ?? 0}
                      ></va-value-card>
                      ${zone === 'must' || zone === 'nice'
                        ? html`
                            <div class="ceiling-input">
                              <label for=${`ceiling-${v.id}`}>${COPY.strategy.ceilingLabel}</label>
                              <input
                                id=${`ceiling-${v.id}`}
                                type="number"
                                min="0"
                                max=${this.team?.credos ?? 150}
                                .value=${String(this.team?.softCeilings[v.id] ?? 0)}
                                aria-describedby=${`ceiling-hint-${v.id}`}
                                @change=${(e: Event) =>
                                  this.setCeiling(
                                    v.id,
                                    Number((e.target as HTMLInputElement).value),
                                  )}
                              />
                              <span id=${`ceiling-hint-${v.id}`} class="ceiling-hint">
                                ${COPY.strategy.ceilingHint}
                              </span>
                            </div>
                          `
                        : ''}
                    </li>
                  `,
                )}
              </ul>
            </section>
          `,
        )}
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
