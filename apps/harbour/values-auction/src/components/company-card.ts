import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Team } from '@/state/types';
import { getStartup } from '@/content/startups';
import { getValue } from '@/content/values';
import { COPY } from '@/content/copy';
import './credos-stack';

@customElement('va-company-card')
export class VaCompanyCard extends LitElement {
  @property({ type: Object }) team?: Team;
  @property({ type: Boolean }) showWon = false;

  static styles = css`
    :host {
      display: block;
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }
    .logo {
      width: 96px;
      height: 96px;
      border-radius: var(--radius-md);
      background: var(--bg);
      object-fit: contain;
    }
    h2 {
      font: var(--type-h1);
      margin-bottom: var(--space-1);
    }
    .sector {
      display: inline-block;
      font: var(--type-small);
      background: var(--wv-cadet-blue);
      color: var(--fg-inverse);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .profile {
      font-size: 16px;
      line-height: 1.5;
    }
    .challenge {
      color: var(--wv-redwood);
      font-weight: 700;
      font-size: 16px;
      line-height: 1.5;
    }
    .won {
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid rgba(39, 50, 72, 0.15);
    }
    .won h3 {
      font: var(--type-h2);
      margin-bottom: var(--space-3);
    }
    .won ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .won li {
      background: var(--wv-champagne);
      border: 1.5px solid var(--wv-cadet-blue);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      font-weight: 700;
      font-size: 14px;
    }
  `;

  render() {
    if (!this.team) return html``;
    const startup = getStartup(this.team.startupId);
    if (!startup) return html``;
    return html`
      <div class="header">
        <img
          class="logo"
          src=${`/logos/${startup.logoKey}.svg`}
          alt=${`${startup.name} logo`}
        />
        <div>
          <h2>${startup.name}</h2>
          <span class="sector">${COPY.scene.sectorLabel}: ${startup.sector}</span>
        </div>
      </div>
      <div class="body">
        <p class="profile">${startup.profile}</p>
        <p class="challenge">${startup.challenge}</p>
        <va-chip
          .count=${this.team.credos}
          label="credos"
          aria-label=${`${this.team.credos} credos remaining`}
        ></va-chip>
        ${this.showWon && this.team.wonValues.length > 0
          ? html`
              <div class="won">
                <h3>locked in</h3>
                <ul>
                  ${this.team.wonValues.map((id) => {
                    const v = getValue(id);
                    return v ? html`<li>${v.name}</li>` : '';
                  })}
                </ul>
              </div>
            `
          : ''}
      </div>
    `;
  }
}
