/**
 * deye-flow-card — Deye-app style power flow card for Home Assistant.
 *
 * Vanilla Web Component: no build step, no dependencies, read-only (no controls).
 */
const CARD_VERSION = '0.1.0';

// Temporary name: the old hand-installed card owns `deye-flow-card` until this one replaces it.
const CARD_TAG = 'deye-flow-card-dev';

const VIEWS = {
  flow: {
    title: 'Потік енергії',
    required: ['pv', 'grid', 'battery', 'battery_soc', 'load'],
  },
};

// Plain-text rows of the skeleton; replaced by the flow diagram in the next step.
const ROWS = [
  { key: 'pv', label: 'Генерація' },
  { key: 'grid', label: 'Мережа' },
  { key: 'battery', label: 'Батарея' },
  { key: 'battery_soc', label: 'Заряд батареї' },
  { key: 'load', label: 'Навантаження' },
];

const fmtW = (w) => {
  if (w == null) return '—';
  const a = Math.abs(w);
  return a >= 1000 ? `${(a / 1000).toFixed(2)} kW` : `${Math.round(a)} W`;
};

const fmtPct = (v) => (v == null ? '—' : `${Math.round(v)}%`);

const STYLES = `
  ha-card { padding: 16px; }
  .title { font-size: 1.15rem; font-weight: 600; margin-bottom: 12px; color: var(--primary-text-color); }
  .title:empty { display: none; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; color: var(--secondary-text-color); }
  .row b { color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
`;

class DeyeFlowCard extends HTMLElement {
  setConfig(config) {
    const view = config.view || 'flow';
    const def = VIEWS[view];
    if (!def) throw new Error(`${CARD_TAG}: unknown view "${view}". Use: ${Object.keys(VIEWS).join(', ')}.`);
    for (const key of def.required) {
      if (typeof config[key] !== 'string' || !config[key]) {
        throw new Error(`${CARD_TAG} (${view}): "${key}" is required (an entity ID)`);
      }
    }
    this._config = { title: def.title, ...config, view };
    // The visual editor calls setConfig on every keystroke, so the DOM is rebuilt from the new config.
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    // HA calls this on EVERY state change in the house, so updates only touch what changed.
    this._hass = hass;
    if (this._config) this._render();
  }

  getCardSize() {
    return 3;
  }

  // Empty keys, not guessed entity IDs: the picker's YAML editor then lists every key to fill in,
  // and the error from setConfig names the first missing one.
  static getStubConfig() {
    return { view: 'flow', pv: '', grid: '', battery: '', battery_soc: '', load: '' };
  }

  // ---------- state helpers ----------

  _num(entityId) {
    const st = this._hass.states[entityId];
    if (!st) return null;
    // unavailable / unknown parse to NaN and are shown as "no value".
    const v = parseFloat(st.state);
    return Number.isFinite(v) ? v : null;
  }

  // ha-solarman reports W, but a sensor may be in kW (e.g. after changing its display unit in HA).
  _watts(entityId) {
    const v = this._num(entityId);
    if (v == null) return null;
    return this._hass.states[entityId].attributes.unit_of_measurement === 'kW' ? v * 1000 : v;
  }

  // ---------- DOM ----------

  _el(id) {
    return this.shadowRoot.getElementById(id);
  }

  _setText(id, text) {
    const el = this._el(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  _render() {
    if (!this._built) this._build();
    this._update();
  }

  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const rows = ROWS.map((r) => `<div class="row"><span>${r.label}</span><b id="val-${r.key}">—</b></div>`).join('');
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="title" id="title"></div>
        ${rows}
      </ha-card>`;
    // textContent, not innerHTML: the title comes from user YAML.
    this._el('title').textContent = this._config.title || '';
    this._built = true;
  }

  _update() {
    const c = this._config;
    this._setText('val-pv', fmtW(this._watts(c.pv)));
    this._setText('val-grid', fmtW(this._watts(c.grid)));
    this._setText('val-battery', fmtW(this._watts(c.battery)));
    this._setText('val-battery_soc', fmtPct(this._num(c.battery_soc)));
    this._setText('val-load', fmtW(this._watts(c.load)));
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, DeyeFlowCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: 'Deye Flow Card (dev)',
  description: 'Deye-app style live power flow: PV, grid, battery, load.',
});

console.info(`%c ${CARD_TAG} ${CARD_VERSION} `, 'background:#34c46a;color:#fff;border-radius:3px');
