/**
 * deye-flow-card — Deye-app style power flow card for Home Assistant.
 *
 * Vanilla Web Component: no build step, no dependencies, read-only (no controls).
 */
const CARD_VERSION = '0.1.1';

// Temporary name: the old hand-installed card owns `deye-flow-card` until this one replaces it.
const CARD_TAG = 'deye-flow-card-dev';

const VIEWS = {
  flow: {
    title: 'Потік енергії',
    required: ['pv', 'grid', 'battery', 'battery_soc', 'load'],
  },
};

const COLORS = {
  pv: '#34c46a',
  battery: '#4aa8ff',
  grid: '#8f6bff',
  load: '#f5b400',
};

// Node centres in % of the square flow area (from the reference).
const NODES = {
  pv:      { x: 20, y: 20, icon: 'mdi:solar-power-variant', label: 'Генерація' },
  grid:    { x: 80, y: 20, icon: 'mdi:transmission-tower', label: 'Мережа' },
  battery: { x: 20, y: 80, icon: 'mdi:battery', label: 'Батарея' },
  load:    { x: 80, y: 80, icon: 'mdi:home-lightning-bolt-outline', label: 'Навантаження' },
};

// Lines in the same 0..100 space, each FROM the outer node TO the inverter box (41..59).
// The direction matters later: the animation moves dots along the path.
const PATHS = {
  pv:      'M 30 20 H 46 V 41',
  grid:    'M 70 20 H 54 V 41',
  battery: 'M 30 80 H 46 V 59',
  load:    'M 70 80 H 54 V 59',
};

const fmtW = (w) => {
  if (w == null) return '—';
  const a = Math.abs(w);
  return a >= 1000 ? `${(a / 1000).toFixed(2)} kW` : `${Math.round(a)} W`;
};

const fmtPct = (v) => (v == null ? '—' : `${Math.round(v)}%`);

const STYLES = `
  ha-card { padding: 16px 16px 8px; }
  .title { font-size: 1.15rem; font-weight: 600; margin-bottom: 12px; color: var(--primary-text-color); }
  .title:empty { display: none; }

  /* Square area; nodes and lines use the same % coordinates, so they line up at any card width.
     Bottom margin leaves room for the captions under the lower nodes. */
  .flow { position: relative; width: 100%; max-width: 420px; aspect-ratio: 1; margin: 0 auto 56px; }
  svg.lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  /* non-scaling-stroke: the viewBox is stretched to the card, but the line stays 1.5 px. */
  .line { fill: none; stroke: var(--divider-color, #ccc); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
  .node, .inverter { position: absolute; width: 20%; aspect-ratio: 1; transform: translate(-50%, -50%); }
  .inverter { left: 50%; top: 50%; width: 18%; }
  .box {
    width: 100%; height: 100%; box-sizing: border-box; border-radius: 22%;
    container-type: inline-size; /* lets children size in cqw = % of box width */
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--card-background-color, #fff);
    border: 2px solid var(--c); color: var(--c);
  }
  .box ha-icon { --mdc-icon-size: 50cqw; display: flex; }
  .extra { font-weight: 700; font-size: 20cqw; line-height: 1.1; }
  .extra:empty { display: none; }
  .extra:not(:empty) + ha-icon { --mdc-icon-size: 38cqw; }
  .caption { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; text-align: center; white-space: nowrap; }
  .value { font-size: 1.1rem; font-weight: 700; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
  .label { font-size: 0.8rem; color: var(--secondary-text-color); }
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

  // Masonry view: units of 50 px, used only to balance columns. ~420 px square + title + captions.
  getCardSize() {
    return 10;
  }

  // Sections view: 12 = full section width. Below 6 columns the node captions overlap.
  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6 };
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
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="title" id="title"></div>
        ${this._flowHtml()}
      </ha-card>`;
    // textContent, not innerHTML: the title comes from user YAML.
    this._el('title').textContent = this._config.title || '';
    this._built = true;
  }

  // HTML nodes on top of one SVG for the lines: icons and text stay crisp and theme-coloured,
  // while the SVG stretches with the card.
  _flowHtml() {
    const nodes = Object.entries(NODES)
      .map(
        ([k, n]) => `
      <div class="node" id="node-${k}" style="left:${n.x}%;top:${n.y}%;--c:${COLORS[k]}">
        <div class="box">
          <div class="extra" id="extra-${k}"></div>
          <ha-icon id="icon-${k}" icon="${n.icon}"></ha-icon>
        </div>
        <div class="caption">
          <div class="value" id="val-${k}">—</div>
          <div class="label" id="lbl-${k}">${n.label}</div>
        </div>
      </div>`
      )
      .join('');
    const lines = Object.entries(PATHS).map(([k, d]) => `<path id="path-${k}" d="${d}" class="line"/>`).join('');
    return `
      <div class="flow">
        <svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        <div class="inverter" style="--c:var(--primary-color)"><div class="box"><ha-icon icon="mdi:current-ac"></ha-icon></div></div>
        ${nodes}
      </div>`;
  }

  _update() {
    const c = this._config;
    this._setText('val-pv', fmtW(this._watts(c.pv)));
    this._setText('val-grid', fmtW(this._watts(c.grid)));
    this._setText('val-battery', fmtW(this._watts(c.battery)));
    this._setText('val-load', fmtW(this._watts(c.load)));
    // SOC sits inside the battery box; `.extra:empty` hides it when there is no value.
    const soc = this._num(c.battery_soc);
    this._setText('extra-battery', soc == null ? '' : fmtPct(soc));
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
