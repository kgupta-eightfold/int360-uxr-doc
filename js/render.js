/* Reusable, data-driven render helpers. No content is authored here —
   every string displayed comes from js/data.js (generated from the sheets). */

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

/* ---------- tags (vocabulary comes straight from the sheet values) ---------- */
const SEV_CLASS = { P1: 'sev-p1', P2: 'sev-p2', P3: 'sev-p3' };
const SEV_ORDER = { P1: 0, P2: 1, P3: 2 };

export function sevTag(value) {
  if (!value) return null;
  return h('span', { class: `tag ${SEV_CLASS[value] || 'sev-p3'}` }, value);
}
export function typeTag(value) {
  return value ? h('span', { class: 'tag t-type' }, value) : null;
}
export function ownerTag(value) {
  return value ? h('span', { class: 'tag t-owner' }, value) : null;
}
export function knownTag(value) {
  if (!value) return null;
  const cls = /unknown/i.test(value) ? 't-unknown' : 't-known';
  return h('span', { class: `tag ${cls}` }, value);
}
export function trackTag(value) {
  return value ? h('span', { class: 'tag t-track' }, value) : null;
}
export function tagRow(...tags) {
  return h('span', { class: 'tagrow' }, ...tags.filter(Boolean));
}

/* ---------- section scaffold (slide-style) ---------- */
export function section(id, index, kicker, title, sub, sourceFile, ...children) {
  return h('section', { class: 'section', id },
    h('div', { class: 'section-head' },
      h('span', { class: 'section-index' }, index),
      h('p', { class: 'section-kicker' }, kicker),
    ),
    h('h2', { class: 'section-title' }, title),
    sub ? h('p', { class: 'section-sub' }, sub) : null,
    ...children,
    sourceFile ? h('p', { class: 'source-note' }, `Source: ${sourceFile} — rendered as-is`) : null,
  );
}

export function statStrip(stats) {
  return h('div', { class: 'stat-strip' },
    stats.map(([n, label]) => h('div', { class: 'stat' }, h('b', {}, String(n)), h('span', {}, label))));
}

/* ---------- side panel (single shared instance) ---------- */
const panelRoot = (() => {
  const backdrop = h('div', { class: 'panel-backdrop', hidden: '' });
  const kicker = h('span', { class: 'ph-kicker' });
  const title = h('h3');
  const body = h('div', { class: 'panel-body' });
  const close = h('button', { class: 'panel-close', 'aria-label': 'Close panel' }, '✕');
  const panel = h('aside', { class: 'panel', role: 'dialog', 'aria-modal': 'true', hidden: '' },
    h('div', { class: 'panel-head' },
      h('div', { class: 'ph-text' }, kicker, title),
      close),
    body);
  document.body.append(backdrop, panel);

  function hide() {
    document.body.classList.remove('panel-open');
    setTimeout(() => { panel.hidden = true; backdrop.hidden = true; }, 220);
  }
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('panel-open')) hide();
  });
  return { backdrop, panel, kicker, title, body, hide };
})();

/* ---------- modal (small detail dialog, 640x480) ---------- */
const modalRoot = (() => {
  const backdrop = h('div', { class: 'modal-backdrop', hidden: '' });
  const kicker = h('span', { class: 'ph-kicker' });
  const title = h('h3');
  const body = h('div', { class: 'modal-body' });
  const close = h('button', { class: 'panel-close', 'aria-label': 'Close dialog' }, '✕');
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', hidden: '' },
    h('div', { class: 'modal-head' },
      h('div', { class: 'ph-text' }, kicker, title),
      close),
    body);
  document.body.append(backdrop, modal);

  function hide() {
    document.body.classList.remove('modal-open');
    setTimeout(() => { modal.hidden = true; backdrop.hidden = true; }, 200);
  }
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('modal-open')) hide();
  });
  return { backdrop, modal, kicker, title, body, hide };
})();

export function openModal(kickerText, titleText, ...content) {
  modalRoot.kicker.textContent = kickerText || '';
  modalRoot.title.textContent = titleText || '';
  modalRoot.body.replaceChildren(...content.flat(Infinity).filter(Boolean));
  modalRoot.modal.hidden = false;
  modalRoot.backdrop.hidden = false;
  void modalRoot.modal.offsetWidth;
  document.body.classList.add('modal-open');
  modalRoot.body.scrollTop = 0;
}

export function openPanel(kickerText, titleText, ...content) {
  panelRoot.kicker.textContent = kickerText || '';
  panelRoot.title.textContent = titleText || '';
  panelRoot.body.replaceChildren(...content.flat(Infinity).filter(Boolean));
  panelRoot.panel.hidden = false;
  panelRoot.backdrop.hidden = false;
  void panelRoot.panel.offsetWidth; // reflow so the slide-in transition runs
  document.body.classList.add('panel-open');
  panelRoot.body.scrollTop = 0;
}

/* ---------- filter controls (shared by card grids and panel explorers) ---------- */
function makeChip(label, isOn, onToggle) {
  const b = h('button', { class: 'chip', type: 'button' }, label);
  const sync = () => b.classList.toggle('on', isOn());
  sync();
  b.addEventListener('click', () => { onToggle(); sync(); });
  return b;
}

function facet(items, key) {
  return [...new Set(items.map(i => i[key]).filter(Boolean))]
    .sort((a, b) => (SEV_ORDER[a] ?? 99) - (SEV_ORDER[b] ?? 99));
}

function facetDropdown(label, values, onChange) {
  return h('select', { class: 'filter-select', 'aria-label': label, onchange: e => onChange(e.target.value) },
    h('option', { value: '' }, `${label}: All`),
    values.map(v => h('option', { value: v }, v)));
}

/* Generic filterable collection. config:
   facets: [[label, key], ...]  — dropdowns built from distinct values
   sortSeverity: bool           — offer P1→P3 ordering toggle (default on)
   render: items => node        — how to draw the filtered result            */
export function explorer(items, config) {
  const state = { selected: new Map(), query: '', sortBySeverity: config.sortSeverity !== false };
  const out = h('div', {});
  const count = h('span', { class: 'result-count' });

  function visible() {
    let v = items.filter(it => {
      for (const [key, val] of state.selected) {
        if (val && it[key] !== val) return false;
      }
      if (state.query) {
        const hay = Object.values(it).join(' ').toLowerCase();
        if (!hay.includes(state.query)) return false;
      }
      return true;
    });
    if (state.sortBySeverity) {
      v = [...v].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
    }
    return v;
  }

  function update() {
    const v = visible();
    count.textContent = `${v.length} of ${items.length} shown`;
    out.replaceChildren(config.render(v));
  }

  const dropdowns = (config.facets || []).map(([label, key]) => {
    const values = facet(items, key);
    if (values.length < 2) return [];
    state.selected.set(key, '');
    return facetDropdown(label, values, val => { state.selected.set(key, val); update(); });
  });

  const controls = h('div', { class: 'controls' },
    ...dropdowns.flat(),
    config.sortSeverity !== false
      ? [h('span', { class: 'label' }, 'Order'),
         makeChip('P1 → P3', () => state.sortBySeverity,
           () => { state.sortBySeverity = !state.sortBySeverity; update(); })]
      : [],
    h('span', { class: 'spacer' }),
    h('input', {
      type: 'search', placeholder: 'Search…',
      oninput: e => { state.query = e.target.value.trim().toLowerCase(); update(); },
    }),
    count,
  );

  update();
  return h('div', {}, controls, out);
}

/* ---------- cards ---------- */
export function cardGrid(...cards) {
  return h('div', { class: 'card-grid' }, ...cards.flat().filter(Boolean));
}

export function personaCard(title, source, stats) {
  return h('div', { class: 'card pcard' },
    h('h3', {}, title),
    h('span', { class: 'psource' }, source),
    h('div', { class: 'pmeta' },
      stats.map(([n, label]) => h('div', {}, h('b', {}, String(n)), h('span', {}, label)))),
  );
}

/* finding summary card — click opens a compact modal with full detail */
export function findingCard(it, detailFields, panelKicker) {
  const open = () => openModal(panelKicker, `${it.id} — ${it.short || it.finding}`,
    h('div', { class: 'detail-block' },
      h('div', { class: 'tagrow', style: 'margin-top:20px' },
        sevTag(it.severity), typeTag(it.type), ownerTag(it.owner),
        knownTag(it.known), trackTag(it.tracks || it.source)),
      detailFields.map(([label, key]) => it[key] ? [
        h('span', { class: 'flabel' }, label),
        h('p', { class: key === 'finding' ? 'lead' : '' }, it[key]),
      ] : []),
    ));
  return h('div', {
    class: 'card fcard', tabindex: '0', role: 'button',
    onclick: open,
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } },
  },
    h('div', { class: 'fc-top' }, h('span', { class: 'fid' }, it.id), sevTag(it.severity)),
    h('h4', {}, it.short || it.finding),
    tagRow(ownerTag(it.owner), knownTag(it.known), trackTag(it.tracks || it.source)),
    h('span', { class: 'fc-open' }, 'View detail →'),
  );
}

export function positiveCards(items) {
  return h('div', { class: 'card-grid' },
    items.map(it => h('div', { class: 'positive' },
      h('span', { class: 'pid' }, it.id),
      h('p', {}, it.finding),
      tagRow(
        ownerTag(it.owner), typeTag(it.type),
        it.participants ? trackTag(it.participants) : null,
        knownTag(it.known),
      ),
    )));
}

export function recCard(it) {
  return h('div', { class: 'card rcard' },
    h('div', { class: 'fc-top' }, h('span', { class: 'rec-num' }, it.num), sevTag(it.severity)),
    h('p', {}, it.recommendation),
    tagRow(ownerTag(it.area), trackTag(it.issueArea)),
    it.painPoint ? h('div', { class: 'rpain' }, it.painPoint) : null,
  );
}

/* ---------- deep-dive sub-cards ---------- */
export function diveRow(label, cards) {
  return h('div', {},
    h('p', { class: 'dive-row-label' }, label),
    h('div', { class: 'dive-row' }, ...cards));
}

export function diveCard(title, countLabel, onOpen) {
  return h('button', { class: 'dive-card', type: 'button', onclick: onOpen },
    h('span', { class: 'dv-title' }, title),
    h('span', { class: 'dv-count' }, countLabel),
    h('span', { class: 'dv-open' }, 'Open panel →'),
  );
}

/* log entries (rendered inside the side panel) */
export function logList(issues) {
  return h('div', {},
    issues.map(it => h('div', { class: 'log-item' },
      h('div', { class: 'lhead' },
        h('span', { class: 'lid' }, it.id),
        sevTag(it.severity),
        typeTag(it.type),
        ownerTag(it.owner),
        it.round ? h('span', { class: 'lround' }, it.round) : null,
      ),
      it.finding ? h('p', {}, it.finding) : null,
      it.recommendation ? h('p', { class: 'lrec' }, it.recommendation) : null,
      it.participants ? h('p', { class: 'lpart' }, it.participants) : null,
    )));
}

/* filterable issue-log explorer for panels */
export function logExplorer(issues) {
  return explorer(issues, {
    facets: [['Severity', 'severity'], ['Type', 'type'], ['Owner', 'owner']],
    render: v => logList(v),
  });
}

/* ---------- plain table ---------- */
export function table(headers, rows) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'bw' },
      h('thead', {}, h('tr', {}, headers.map(th => h('th', {}, th)))),
      h('tbody', {}, rows.map(cells => h('tr', {}, cells.map(c =>
        (c && c.nodeType) ? h('td', {}, c) : h('td', { class: typeof c === 'string' && c.length < 6 ? 'num' : '' }, c ?? '—')
      )))),
    ));
}

export function tableCard(...children) {
  return h('div', { class: 'table-card' }, ...children.flat().filter(Boolean));
}
