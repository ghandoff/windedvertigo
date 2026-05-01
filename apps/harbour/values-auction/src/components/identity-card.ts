import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Team } from '@/state/types';
import { getStartup } from '@/content/startups';
import { getValue } from '@/content/values';

@customElement('va-identity-card')
export class VaIdentityCard extends LitElement {
  @property({ type: Object }) team?: Team;

  static styles = css`
    :host {
      display: block;
    }
    .card {
      width: 100%;
      max-width: 600px;
      aspect-ratio: 1200 / 630;
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card-lifted);
      padding: var(--space-6);
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: var(--space-5);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--wv-champagne) 0%, var(--bg-card) 50%);
      z-index: 0;
    }
    .card > * {
      position: relative;
      z-index: 1;
    }
    .logo-box {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img.logo {
      width: 100%;
      max-width: 160px;
    }
    h2 {
      font: var(--type-display);
      font-size: 36px;
      margin-bottom: var(--space-2);
    }
    .sector {
      font: var(--type-small);
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      display: inline-block;
      margin-bottom: var(--space-4);
    }
    .purpose {
      font: var(--type-h2);
      font-size: 18px;
      line-height: 1.4;
      margin-bottom: var(--space-4);
    }
    .values {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .values span {
      font: var(--type-small);
      background: var(--wv-champagne);
      color: var(--wv-cadet-blue);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      border: 1px solid var(--wv-cadet-blue);
    }
  `;

  render() {
    if (!this.team) return html``;
    const startup = getStartup(this.team.startupId);
    if (!startup) return html``;
    return html`
      <div class="card" id="identity-card">
        <div class="logo-box">
          <img
            class="logo"
            src=${`/logos/${startup.logoKey}.svg`}
            alt=${`${startup.name} logo`}
          />
        </div>
        <div>
          <h2>${startup.name}</h2>
          <div class="sector">${startup.sector}</div>
          <div class="purpose">${this.team.purposeStatement ?? 'purpose in progress...'}</div>
          <div class="values">
            ${this.team.wonValues.map((id) => {
              const v = getValue(id);
              return v ? html`<span>${v.name}</span>` : '';
            })}
          </div>
        </div>
      </div>
    `;
  }
}
