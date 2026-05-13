import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { loadPrefs, savePrefs, subscribePrefs, type Prefs } from '@/state/prefs';

/**
 * floating accessibility controls. one button, top-right of the viewport,
 * that opens a small panel with three controls:
 *   - text size: regular / large / x-large
 *   - motion:    full / subtle / none
 *   - theme:     default / dark / high-contrast
 *
 * choices persist in localStorage (`va:prefs`) and apply globally via
 * data-attributes on <html>, read by base.css.
 */
@customElement('va-settings-drawer')
export class VaSettingsDrawer extends LitElement {
  @state() private open = false;
  @state() private prefs: Prefs = loadPrefs();
  private unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.unsub = subscribePrefs((p) => (this.prefs = p));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
  }

  static styles = css`
    :host {
      position: fixed;
      top: var(--space-3);
      right: var(--space-3);
      z-index: 50;
      font-family: 'Atkinson Hyperlegible', system-ui, sans-serif;
    }
    button.toggle {
      min-width: 48px;
      min-height: 48px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-pill);
      border: 2px solid var(--wv-cadet-blue);
      background: var(--bg-card);
      color: var(--fg);
      font: var(--type-small);
      font-weight: 700;
      cursor: pointer;
      box-shadow: var(--shadow-card);
    }
    button.toggle:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .panel {
      margin-top: var(--space-2);
      background: var(--bg-card);
      color: var(--fg);
      border: 1px solid rgba(39, 50, 72, 0.15);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      box-shadow: var(--shadow-card-lifted);
      width: 280px;
      max-width: calc(100vw - var(--space-5));
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .panel h2 {
      font: var(--type-h2);
      font-size: 18px;
      margin: 0;
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    legend {
      font: var(--type-small);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--fg-muted);
      padding: 0;
    }
    .options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-1);
    }
    .options button {
      min-height: 48px;
      padding: var(--space-2) var(--space-1);
      border: 2px solid rgba(39, 50, 72, 0.2);
      background: var(--bg);
      color: var(--fg);
      border-radius: var(--radius-sm);
      font: var(--type-small);
      font-weight: 700;
      cursor: pointer;
      line-height: 1.2;
    }
    .options button[aria-pressed='true'] {
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      border-color: var(--wv-cadet-blue);
    }
    .options button:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .hint {
      font: var(--type-small);
      color: var(--fg-muted);
      margin: 0;
      line-height: 1.5;
    }
    @media (prefers-reduced-motion: no-preference) {
      .panel {
        animation: va-fade-in var(--dur-base) var(--ease-out-quart);
      }
    }
  `;

  private set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    this.prefs = savePrefs({ [key]: value } as Partial<Prefs>);
  }

  private optionGroup<T extends string>(
    legend: string,
    key: keyof Prefs,
    options: readonly { value: T; label: string }[],
  ) {
    return html`
      <fieldset>
        <legend>${legend}</legend>
        <div class="options" role="group" aria-label=${legend}>
          ${options.map(
            (opt) => html`
              <button
                type="button"
                aria-pressed=${this.prefs[key] === opt.value ? 'true' : 'false'}
                @click=${() => this.set(key, opt.value as Prefs[typeof key])}
              >
                ${opt.label}
              </button>
            `,
          )}
        </div>
      </fieldset>
    `;
  }

  render() {
    return html`
      <button
        type="button"
        class="toggle"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls="va-settings-panel"
        @click=${() => (this.open = !this.open)}
      >
        ${this.open ? 'close' : 'display & motion'}
      </button>
      ${this.open
        ? html`
            <div
              id="va-settings-panel"
              class="panel"
              role="dialog"
              aria-label="display and motion settings"
            >
              <h2>display & motion</h2>
              ${this.optionGroup('text size', 'textSize', [
                { value: 'md', label: 'regular' },
                { value: 'lg', label: 'large' },
                { value: 'xl', label: 'x-large' },
              ])}
              ${this.optionGroup('motion', 'motion', [
                { value: 'full', label: 'full' },
                { value: 'subtle', label: 'subtle' },
                { value: 'none', label: 'none' },
              ])}
              ${this.optionGroup('theme', 'theme', [
                { value: 'default', label: 'default' },
                { value: 'dark', label: 'dark' },
                { value: 'high-contrast', label: 'high contrast' },
              ])}
              <p class="hint">
                changes save to this device and apply right away. open this again any time
                to adjust.
              </p>
            </div>
          `
        : ''}
    `;
  }
}
