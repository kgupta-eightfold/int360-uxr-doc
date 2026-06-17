/* App shell: routing between the two study tracks, page assembly.
   All displayed content comes from UXR (js/data.js, generated verbatim
   from the sheet exports) — nothing is authored in the UI layer. */

import {
  h, section, statStrip, explorer, cardGrid, personaCard, findingCard,
  positiveCards, recCard, diveRow, diveCard, logExplorer, logList,
  openPanel, openModal, table, tableCard, trackTag,
  sevTag, typeTag, ownerTag, knownTag, tagRow,
} from './render.js';

/* Data is provided by the password gate (js/gate.js) after decryption.
   The plaintext data files (data.js / v2content.js) are not shipped to the repo. */
const { UXR, V2, STAGES } = window.__APPDATA__;

const app = document.getElementById('app');
const subnav = document.getElementById('subnav');

const SECTIONS = [
  ['overview', 'Persona overview'],
  ['what-works', 'What works?'],
  ['issues', 'Issues identified'],
  ['recommendations', 'Recommendations'],
];

/* ------------- recommendations (per-track tables from the sheet) ---------- */
/* The updated Recommendations sheet is itself split into two tables:
   table 0 = recruiter-side fixes, table 1 = candidate-side fixes.
   That categorisation is used as-is — no re-mapping in the UI layer. */
const REC_TABLE_FOR = { recruiter: 0, candidate: 1 };
const UX_IMPROVEMENT_SCOPE = {
  candidate: ['Candidate exp'],
  recruiter: ['Feedback form', 'Scheduling'],
};

function recommendationsSection(track) {
  const rec = UXR.recommendations;
  const scoped = rec.tables[REC_TABLE_FOR[track]]?.items ?? [];
  const improvements = UXR.uxImprovements.items
    .filter(i => UX_IMPROVEMENT_SCOPE[track].includes(i.area));

  return section('recommendations', '04', 'Recommendations', rec.title,
    `${rec.note} Showing the ${track}-side table as categorised in the source sheet.`, rec.source,
    explorer(scoped, {
      facets: [['Severity', 'severity'], ['Product area', 'area']],
      render: v => cardGrid(v.map(recCard)),
    }),
    rec.summaryLine ? h('div', { class: 'note-block' }, rec.summaryLine) : null,
    improvements.length ? [
      h('p', { class: 'mini-title' }, 'List of UX improvements'),
      tableCard(table(['Improvement', 'Product area'],
        improvements.map(i => [i.improvement, trackTag(i.area)]))),
      h('p', { class: 'source-note' }, `Source: ${UXR.uxImprovements.source} — rendered as-is`),
    ] : [],
  );
}

/* ---------------------------- candidate page ------------------------------ */
const CANDIDATE_DETAIL = [
  ['Finding', 'finding'],
  ['Recommendation', 'recommendation'],
  ['Track(s)', 'tracks'],
];

/* Summary.html's "What Worked Well" block mixes candidate and recruiter rows.
   Rows whose participants are recruiter-only (e.g. '3/3 rec') surface
   on the recruiter tab; rows with candidate counts (n/10) stay on candidate. */
const summaryWW = UXR.summary.whatWorked.items;
const candidateWW = summaryWW.filter(it => /\/10/.test(it.participants || ''));
const recruiterWW = summaryWW.filter(it => !/\/10/.test(it.participants || ''));

function candidatePage() {
  const sum = UXR.summary.candidate;
  const logs = [UXR.logs.tech, UXR.logs.functional, UXR.logs.hvh];
  const p1 = sum.findings.filter(f => f.severity === 'P1').length;
  const unknown = sum.findings.filter(f => /unknown/i.test(f.known || '')).length;

  return [
    section('overview', '01', 'Persona overview', sum.title, sum.subtitle, UXR.summary.source,
      statStrip([
        [sum.findings.length, 'Cross-track findings'],
        [p1, 'P1 severity'],
        [unknown, 'Previously unknown'],
        [UXR.summary.whatWorked.items.length, 'What worked'],
      ]),
      cardGrid(logs.map(log => personaCard(
        log.title.replace('UXR Issues Log — ', ''),
        log.source.replace('.html', ''),
        [
          [log.issues.length, 'Issues'],
          [log.issues.filter(i => i.severity === 'P1').length, 'P1'],
        ]))),
    ),

    section('what-works', '02', 'What works?', UXR.summary.whatWorked.title, null, UXR.summary.source,
      positiveCards(candidateWW),
      diveRow('Deep dive — per-track positives', logs.map(log =>
        diveCard(log.title.replace('UXR Issues Log — ', ''),
          `${log.whatWorked.length} positives · ${log.source}`,
          () => openPanel(`Deep dive · ${log.source} — rendered as-is`, log.title,
            positiveCards(log.whatWorked))))),
    ),

    section('issues', '03', 'Issues identified', sum.title, sum.subtitle, UXR.summary.source,
      explorer(sum.findings, {
        facets: [['Severity', 'severity'], ['Status', 'known']],
        render: v => cardGrid(v.map(it =>
          findingCard(it, CANDIDATE_DETAIL, `${UXR.summary.source} — rendered as-is`))),
      }),
      diveRow('Deep dive — track issue logs', logs.map(log =>
        diveCard(log.title.replace('UXR Issues Log — ', ''),
          `${log.issues.length} issues · ${log.source}`,
          () => openPanel(`Deep dive · ${log.source} — rendered as-is`, log.title,
            logExplorer(log.issues))))),
    ),

    recommendationsSection('candidate'),
  ];
}

/* ---------------------------- recruiter page ------------------------------ */
const RECRUITER_DETAIL = [
  ['Finding', 'finding'],
  ['Recommendation', 'recommendation'],
  ['Source', 'source'],
];

function recruiterPage() {
  const sum = UXR.summary.recruiter;
  const modLog = UXR.logs.recruiter;
  const unmodLog = UXR.unmoderated.log;
  const study = UXR.unmoderated.study;
  const p1 = sum.findings.filter(f => f.severity === 'P1').length;
  const unknown = sum.findings.filter(f => /unknown/i.test(f.known || '')).length;
  const unmodCount = unmodLog.scheduling.issues.length + unmodLog.feedback.issues.length;

  const participantTable = group => table(
    ['Participant', 'Country', 'Task result', 'Sched', 'Clarity', 'Hire on AI alone?', 'Key observation'],
    group.participants.map(p => [
      p.participant, p.country, p.taskResult, p.schedRating, p.clarityRating, p.hireOnAI, p.keyObservation,
    ]));

  return [
    section('overview', '01', 'Persona overview', sum.title, sum.subtitle, UXR.summary.source,
      statStrip([
        [sum.findings.length, 'Summary findings'],
        [p1, 'P1 severity'],
        [unknown, 'Previously unknown'],
        [modLog.issues.length, 'Moderated issues'],
        [unmodCount, 'Unmoderated issues'],
      ]),
      cardGrid(
        personaCard('Moderated recruiters', UXR.summary.source.replace('.html', ''), [
          [modLog.issues.length, 'Issues'],
          [modLog.issues.filter(i => i.severity === 'P1').length, 'P1'],
          [modLog.whatWorked.length, 'Positives'],
        ]),
        personaCard('Unmoderated recruiters', study.source.replace('.html', ''), [
          [unmodCount, 'Issues'],
          [study.groups[0]?.participants.length ?? 0, 'Completed'],
          [study.groups[1]?.participants.length ?? 0, 'Struggled'],
        ]),
      ),
      h('p', { class: 'mini-title' }, study.title),
      h('p', { class: 'section-sub' }, study.subtitle),
      diveRow('Deep dive — participants & hire-decision split', [
        ...study.groups.map(g => diveCard(g.label,
          `${g.participants.length} participants · ${study.source}`,
          () => openPanel(`Deep dive · ${study.source} — rendered as-is`, g.label,
            tableCard(participantTable(g))))),
        diveCard(study.hireDecision.title, `${study.hireDecision.rows.length} responses · ${study.source}`,
          () => openPanel(`Deep dive · ${study.source} — rendered as-is`, study.hireDecision.title,
            tableCard(table(['Response', 'Participants', 'Proportion'],
              study.hireDecision.rows.map(r => [r.response, r.participants, r.proportion]))),
            study.hireDecision.note ? h('div', { class: 'note-block' }, study.hireDecision.note) : null)),
      ]),
    ),

    section('what-works', '02', 'What works?', UXR.summary.whatWorked.title, null, null,
      positiveCards(recruiterWW),
      h('p', { class: 'source-note' }, `Source: ${UXR.summary.source} — rendered as-is`),
      h('p', { class: 'mini-title' }, modLog.title),
      positiveCards(modLog.whatWorked),
      h('p', { class: 'source-note' }, `Source: ${modLog.source} — rendered as-is`),
      h('p', { class: 'mini-title' }, unmodLog.title),
      positiveCards(unmodLog.whatWorked),
      h('p', { class: 'source-note' }, `Source: ${unmodLog.source} — rendered as-is`),
    ),

    section('issues', '03', 'Issues identified', sum.title, sum.subtitle, UXR.summary.source,
      explorer(sum.findings, {
        facets: [['Severity', 'severity'], ['Status', 'known']],
        render: v => cardGrid(v.map(it =>
          findingCard(it, RECRUITER_DETAIL, `${UXR.summary.source} — rendered as-is`))),
      }),
      diveRow('Deep dive — recruiter issue logs', [
        diveCard(modLog.title.replace('UXR Issues Log — ', ''),
          `${modLog.issues.length} issues · ${modLog.source}`,
          () => openPanel(`Deep dive · ${modLog.source} — rendered as-is`, modLog.title,
            logExplorer(modLog.issues))),
        diveCard(unmodLog.scheduling.title, `${unmodLog.scheduling.issues.length} issues · ${unmodLog.source}`,
          () => openPanel(`Deep dive · ${unmodLog.source} — rendered as-is`, unmodLog.scheduling.title,
            ...unmodLog.panelNotes.map(n => h('div', { class: 'note-block' }, n)),
            logExplorer(unmodLog.scheduling.issues))),
        diveCard(unmodLog.feedback.title, `${unmodLog.feedback.issues.length} issues · ${unmodLog.source}`,
          () => openPanel(`Deep dive · ${unmodLog.source} — rendered as-is`, unmodLog.feedback.title,
            logExplorer(unmodLog.feedback.issues))),
        diveCard(study.keyFindings.title,
          `${study.keyFindings.positives.length + study.keyFindings.issues.length} findings · ${study.source}`,
          () => openPanel(`Deep dive · ${study.source} — rendered as-is`, study.keyFindings.title,
            h('p', { class: 'mini-title' }, 'Positives'),
            tableCard(table(['Finding', 'Who', 'Count'],
              study.keyFindings.positives.map(f => [f.finding, f.who, f.count]))),
            h('p', { class: 'mini-title' }, 'Issues'),
            tableCard(table(['Finding', 'Who', 'Count'],
              study.keyFindings.issues.map(f => [f.finding, f.who, f.count]))),
            h('p', { class: 'mini-title' }, study.lowerConfidence.title),
            tableCard(table(['Finding', 'Who', 'Count'],
              study.lowerConfidence.items.map(f => [f.finding, f.who, f.count]))))),
      ]),
    ),

    recommendationsSection('recruiter'),
  ];
}

/* ========================================================================== */
/* v2 — "Updated view": Agenda & Context · Findings · Appendix                */
/* Findings/counts/tags all come from UXR; framing prose from V2 (v2content). */
/* ========================================================================== */

/* candidateWW / recruiterWW are defined above (Summary.html WW split by track). */

/* flat raw research log for the appendix, scoped per track */
const RAW_BY_TRACK = {
  candidate: [
    ...UXR.logs.tech.issues.map(r => ({ ...r, source: 'Tech Log' })),
    ...UXR.logs.functional.issues.map(r => ({ ...r, source: 'Functional Log' })),
    ...UXR.logs.hvh.issues.map(r => ({ ...r, source: 'HVH Log' })),
  ],
  recruiter: [
    ...UXR.logs.recruiter.issues.map(r => ({ ...r, source: 'Recruiter Log' })),
    ...UXR.unmoderated.log.scheduling.issues.map(r => ({ ...r, source: 'Unmod · Scheduling' })),
    ...UXR.unmoderated.log.feedback.issues.map(r => ({ ...r, source: 'Unmod · Feedback' })),
  ],
};

/* ---- Page 1: Agenda & Context ---- */
function v2Block(title, ...children) {
  return h('div', { class: 'v2-block' }, h('h3', { class: 'mini-title' }, title), ...children);
}

function personaSlide(p) {
  return h('article', { class: `pslide pslide--${p.key.toLowerCase()}` },
    h('span', { class: 'pslide-count' }, p.count),
    h('h4', {}, p.name),
    h('p', { class: 'pslide-role' }, p.role),
    h('p', { class: 'pslide-watch' }, p.watch),
    h('div', { class: 'pslide-viz' }),
  );
}

function personaCarousel(personas) {
  const track = h('div', { class: 'carousel-track' }, personas.map(personaSlide));
  const nudge = dir => track.scrollBy({ left: dir * (track.firstChild.offsetWidth + 18), behavior: 'smooth' });
  return h('div', { class: 'carousel' },
    track,
    h('div', { class: 'carousel-arrows' },
      h('button', { class: 'carousel-arrow', 'aria-label': 'Scroll personas left', onclick: () => nudge(-1) }, '‹'),
      h('button', { class: 'carousel-arrow', 'aria-label': 'Scroll personas right', onclick: () => nudge(1) }, '›'),
    ));
}

const PERSONA_HINT = {
  candidate: '10 candidates across the Tech, Functional and HVH tracks.',
  recruiter: '20 recruiters: 3 moderated and 17 unmoderated, across US, India and UK.',
};

function agendaPage() {
  const c = V2[v2track];
  return [
    h('section', { class: 'section v2-page' },
      h('div', { class: 'section-head' },
        h('span', { class: 'section-index' }, '01'),
        h('p', { class: 'section-kicker' }, 'Agenda & Context')),
      h('p', { class: 'section-sub deck-eyebrow' }, c.deckSub),
      h('h2', { class: 'section-title hero-title' }, V2.deckTitle),
      h('p', { class: 'v2-hero' }, c.hero.lead, h('span', { class: 'emph' }, c.hero.emph), c.hero.tail),

      v2Block('Agenda',
        h('ol', { class: 'agenda-list' }, c.agenda.map(t => h('li', {}, h('span', {}, t))))),

      v2Block('Goals of the research',
        h('div', { class: 'goal-grid' }, c.goals.map((g, i) =>
          h('div', { class: 'goal-card' }, h('span', { class: 'goal-num' }, `0${i + 1}`), h('p', {}, g))))),

      v2Block('Personas considered',
        personaCarousel(c.personas),
        h('p', { class: 'carousel-hint' }, PERSONA_HINT[v2track])),

      v2Block('Coverage — the interview journey we probed',
        h('div', { class: 'journey' }, c.coverage.map((cov, i) =>
          h('div', { class: 'journey-step' },
            h('span', { class: 'journey-line' }),
            h('span', { class: 'journey-num' }, String(i + 1)),
            h('h4', {}, cov.stage),
            h('p', {}, cov.summary))))),

      h('p', { class: 'source-note' }, 'Findings counts & tags sourced from the research sheets; agenda, goals, persona descriptors and coverage summaries are presentation framing.'),
    ),
  ];
}

/* ---- Page 2: Findings (image + 3 parallel finding sets) ---- */
const FINDING_LENSES = {
  candidate: [
    { key: 'all', label: 'All' },
    { key: 'tech', label: 'Tech' },
    { key: 'functional', label: 'Functional' },
    { key: 'hvh', label: 'HVH' },
  ],
  recruiter: [
    { key: 'all', label: 'All' },
    { key: 'moderated', label: 'Moderated' },
    { key: 'unmoderated', label: 'Unmoderated' },
  ],
};

function lensData(track, key) {
  if (track === 'candidate') {
    const recs = UXR.recommendations.tables[1]?.items ?? [];
    if (key === 'all') {
      return {
        works: candidateWW,
        critical: UXR.summary.candidate.findings.filter(f => f.severity === 'P1'),
        recs, caption: 'All candidate personas — cross-track summary',
      };
    }
    const log = UXR.logs[key];
    return {
      works: log.whatWorked,
      critical: log.issues.filter(i => i.severity === 'P1'),
      recs, caption: log.title.replace('UXR Issues Log — ', ''),
    };
  }
  // recruiter
  const recs = UXR.recommendations.tables[0]?.items ?? [];
  if (key === 'moderated') {
    const log = UXR.logs.recruiter;
    return {
      works: log.whatWorked,
      critical: log.issues.filter(i => i.severity === 'P1'),
      recs, caption: 'Moderated recruiters',
    };
  }
  if (key === 'unmoderated') {
    const u = UXR.unmoderated.log;
    return {
      works: u.whatWorked,
      critical: [...u.scheduling.issues, ...u.feedback.issues].filter(i => i.severity === 'P1'),
      recs, caption: 'Unmoderated recruiters — US · India · UK',
    };
  }
  return {
    works: recruiterWW,
    critical: UXR.summary.recruiter.findings.filter(f => f.severity === 'P1'),
    recs, caption: 'All recruiters — moderated + unmoderated',
  };
}

function worksItem(it) {
  return h('div', { class: 'fcol-item' },
    h('p', {}, it.finding),
    tagRow(ownerTag(it.owner || it.type), it.participants ? trackTag(it.participants) : null, knownTag(it.known)));
}

function criticalItem(it) {
  const heading = it.short ? `${it.id} — ${it.short}` : `Finding ${it.id}`;
  const open = () => openModal('Critical feedback', heading,
    h('div', { class: 'detail-block' },
      h('div', { class: 'tagrow', style: 'margin-top:18px' },
        sevTag(it.severity), typeTag(it.type), ownerTag(it.owner), knownTag(it.known),
        trackTag(it.tracks || it.source || it.round)),
      it.finding ? [h('span', { class: 'flabel' }, 'Finding'), h('p', { class: 'lead' }, it.finding)] : [],
      it.recommendation ? [h('span', { class: 'flabel' }, 'Recommendation'), h('p', {}, it.recommendation)] : [],
      (it.tracks || it.source) ? [h('span', { class: 'flabel' }, it.tracks ? 'Track(s)' : 'Source'), h('p', {}, it.tracks || it.source)] : []));
  return h('button', { class: 'fcol-item is-click', type: 'button', onclick: open },
    h('div', { class: 'fcol-id' }, it.id, sevTag(it.severity)),
    h('p', {}, it.short || it.finding),
    tagRow(ownerTag(it.owner), trackTag(it.tracks || it.round)));
}

function recItem(it) {
  return h('div', { class: 'fcol-item' },
    h('div', { class: 'fcol-id' }, `#${it.num}`, sevTag(it.severity)),
    h('p', {}, it.recommendation),
    tagRow(ownerTag(it.area), trackTag(it.issueArea)));
}

function findingsColumn(modifier, dot, title, items, renderItem) {
  return h('div', { class: `fcol fcol--${modifier}` },
    h('div', { class: 'fcol-head' },
      h('span', { class: `fcol-dot ${dot}` }),
      h('span', { class: 'fcol-title' }, title),
      h('span', { class: 'fcol-count' }, String(items.length))),
    items.length ? items.map(renderItem) : h('p', { class: 'fcol-empty' }, 'None recorded.'));
}

function findingsPage() {
  const lenses = FINDING_LENSES[v2track];
  let lens = 'all';
  const stage = h('div', {});

  const renderStage = () => {
    const d = lensData(v2track, lens);
    stage.replaceChildren(
      h('div', { class: 'findings-layout' },
        h('div', { class: 'findings-media' },
          h('div', { class: 'findings-media-box' }, h('span', {}, 'Image / screenshot')),
          h('p', { class: 'findings-media-cap' }, d.caption)),
        h('div', { class: 'findings-cols' },
          findingsColumn('works', 'dot-works', 'What works well', d.works, worksItem),
          findingsColumn('critical', 'dot-critical', 'Critical feedbacks', d.critical, criticalItem),
          findingsColumn('recs', 'dot-recs', 'Recommendations', d.recs, recItem),
        )),
    );
  };

  const lensBar = h('div', { class: 'lens-bar' },
    h('span', { class: 'label' }, 'Lens'),
    lenses.map(l => {
      const b = h('button', { class: 'chip' + (l.key === lens ? ' on' : ''), type: 'button' }, l.label);
      b.addEventListener('click', () => {
        if (lens === l.key) return;
        lens = l.key;
        lensBar.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.textContent === l.label));
        renderStage();
      });
      return b;
    }));

  const rows = RAW_BY_TRACK[v2track];
  const recCount = (v2track === 'candidate' ? UXR.recommendations.tables[1] : UXR.recommendations.tables[0])?.items.length ?? 0;
  const band = v2track === 'candidate'
    ? [['10', 'Candidates'], [String(rows.length), 'Observations'],
       [String(rows.filter(r => r.severity === 'P1').length), 'Critical · P1'], [String(recCount), 'Recommendations']]
    : [['20', 'Recruiters'], [String(rows.length), 'Observations'],
       [String(rows.filter(r => r.severity === 'P1').length), 'Critical · P1'], [String(recCount), 'Recommendations']];

  renderStage();
  return [
    h('section', { class: 'section v2-page' },
      h('div', { class: 'section-head' },
        h('span', { class: 'section-index' }, '02'),
        h('p', { class: 'section-kicker' }, 'Findings')),
      h('h2', { class: 'section-title hero-title' }, 'What we heard'),
      h('p', { class: 'section-sub' }, 'What works, critical feedback, and recommendations — read in parallel against the supporting evidence. Switch the lens to focus on a single persona.'),
      h('div', { class: 'stat-band' }, band.map(([n, l]) =>
        h('div', { class: 'sb' }, h('b', {}, n), h('span', {}, l)))),
      lensBar,
      stage,
      h('p', { class: 'source-note' }, 'What works → Summary / per-track logs · Critical → P1 findings · Recommendations → updated recommendations sheet. Rendered as-is.'),
    ),
  ];
}

/* ---- Appendix: raw research log (search + filters), scoped per track ---- */
const APPENDIX_SOURCES = {
  candidate: 'Tech / Functional / HVH candidate logs',
  recruiter: 'Recruiter log + Unmoderated recruiter (scheduling & feedback)',
};

function appendixPage() {
  const rows = RAW_BY_TRACK[v2track];
  return [
    h('section', { class: 'section v2-page' },
      h('div', { class: 'section-head' },
        h('span', { class: 'section-index' }, '03'),
        h('p', { class: 'section-kicker' }, 'Appendix')),
      h('h2', { class: 'section-title' }, 'Raw research log'),
      h('p', { class: 'section-sub' }, `Every logged ${v2track} observation (${rows.length} rows). Search the text or filter by source, severity, type, and owner.`),
      explorer(rows, {
        facets: [['Source', 'source'], ['Severity', 'severity'], ['Type', 'type'], ['Owner', 'owner']],
        render: v => tableCard(table(
          ['ID', 'Source', 'Sev', 'Type', 'Stage', 'Finding', 'Recommendation', 'Participants', 'Owner'],
          v.map(r => [
            r.id, r.source, sevTag(r.severity), typeTag(r.type), r.round,
            r.finding, r.recommendation, r.participants, ownerTag(r.owner),
          ]))),
      }),
      h('p', { class: 'source-note' }, `Sources: ${APPENDIX_SOURCES[v2track]} — rendered as-is.`),
    ),
  ];
}

const V2_PAGES = [
  ['agenda', 'Agenda & Context', agendaPage],
  ['findings', 'Findings', findingsPage],
  ['appendix', 'Appendix', appendixPage],
];
let v2track = 'candidate';  // Candidate / Recruiter tab (shared by v2 & v3)
let v2page = 'agenda';      // Agenda & Context / Findings / Appendix

/* ========================================================================== */
/* v3 — single-scroll narrative (light glassmorphism, Apple-style reveals,    */
/* pinned horizontal Findings detail). Wireframe: Figma 360 UXR readout.      */
/* ========================================================================== */

const V3_SECTIONS = [
  ['v3-agenda', 'Agenda'], ['v3-goals', 'Goals'], ['v3-personas', 'Personas'],
  ['v3-coverage', 'Coverage'], ['v3-findings', 'Findings'], ['v3-appendix', 'Appendix'],
];

function v3Sec(id, kicker, title, sub, ...blocks) {
  return h('section', { class: 'section v3-sec', id },
    h('div', { class: 'v3-wrap' },
      h('div', { class: 'reveal v3-head' },
        h('p', { class: 'section-kicker' }, kicker),
        h('h2', { class: 'section-title' }, title),
        sub ? h('p', { class: 'section-sub' }, sub) : null),
      ...blocks));
}

function v3AppendixRow(r) {
  return h('div', { class: 'glass v3-row' },
    h('div', { class: 'v3-row-id' }, r.id, h('span', { class: 'v3-row-src' }, r.source)),
    h('p', { class: 'v3-row-finding' }, r.finding),
    h('div', { class: 'tagrow' }, sevTag(r.severity), typeTag(r.type), ownerTag(r.owner),
      r.round ? trackTag(r.round) : null));
}

/* ---- journey sets: bucket findings into journey stages per track ---- */
function candFeedbackPhase(r) {
  if (/post/i.test(r.round)) return 'post';
  if (/onboard|entry/i.test(r.round)) return /invite|email|legitim|recording|consent|why ai/i.test(r.finding) ? 'email' : 'landing';
  return 'interview';
}
function candRecPhase(it) {
  const a = it.issueArea || '';
  if (/post/i.test(a)) return 'post';
  if (/onboard/i.test(a)) return /invite|email|why ai|benefit|legitim|frame/i.test(it.recommendation) ? 'email' : 'landing';
  if (/interview/i.test(a)) return 'interview';
  return 'landing'; // All flows
}
function candWorksPhase(w) {
  const t = w.finding || '';
  if (/invite|email|intro video/i.test(t)) return 'email';
  if (/landing|360|expectation|section breakdown|prep|overview|tutorial|pre-interview/i.test(t)) return 'landing';
  if (/post|feedback|next step|result|rating|notification/i.test(t)) return 'post';
  return 'interview';
}
function recFeedbackPhase(r) {
  if (/output|feedback/i.test(r.round)) return 'output';
  if (/communication/i.test(r.round)) return 'comms';
  return 'scheduling';
}
function recRecPhase(it) {
  if (/feedback/i.test(it.issueArea || '')) return 'output';
  if (/scheduling/i.test(it.issueArea || '')) return 'scheduling';
  return 'comms';
}
function recWorksPhase(w) {
  const t = w.finding || '';
  if (/feedback|summary|flagged|output|score|background/i.test(t)) return 'output';
  return 'scheduling';
}

function buildJourneySets(track) {
  const rows = RAW_BY_TRACK[track];
  const recs = (track === 'candidate' ? UXR.recommendations.tables[1] : UXR.recommendations.tables[0])?.items ?? [];
  if (track === 'candidate') {
    const worksPool = [...UXR.logs.tech.whatWorked, ...UXR.logs.functional.whatWorked, ...UXR.logs.hvh.whatWorked];
    const mk = (key, label, images) => ({ key, label, images, tabs: {
      works: worksPool.filter(w => candWorksPhase(w) === key),
      feedback: rows.filter(r => candFeedbackPhase(r) === key),
      recs: recs.filter(it => candRecPhase(it) === key) } });
    return [
      mk('email', 'Email', ['Invite email']),
      mk('landing', 'Landing page', ['Landing page', 'Pre-interview checks']),
      mk('interview', 'In interview', ['Screening', 'Role fit / case', 'Coding', 'Whiteboarding']),
      mk('post', 'Post interview', ['Results & feedback']),
    ];
  }
  const worksPool = [...UXR.logs.recruiter.whatWorked, ...UXR.unmoderated.log.whatWorked];
  const mk = (key, label, images) => ({ key, label, images, tabs: {
    works: worksPool.filter(w => recWorksPhase(w) === key),
    feedback: rows.filter(r => recFeedbackPhase(r) === key),
    recs: recs.filter(it => recRecPhase(it) === key) } });
  return [
    mk('scheduling', 'Guide & scheduling', ['Guide selection', 'Customise & schedule']),
    mk('output', 'Output review', ['Feedback / output', 'Flagged activities']),
    mk('comms', 'Candidate comms', ['AI invite email']),
  ];
}

/* ---- findings detail: set switcher + image(carousel) + click tabs + cards.
   Everything toggles on click; the section lives in normal flow (page scrolls
   naturally and the card stack is fully reachable). ---- */
const TAB_DEFS = [
  { key: 'works', label: 'What worked', render: worksItem },
  { key: 'feedback', label: 'Feedback', render: criticalItem },
  { key: 'recs', label: 'Recommendation', render: recItem },
];

function mediaButton(img, contextLabel) {
  const o = typeof img === 'string' ? { label: img } : (img || {});
  const title = contextLabel ? `${contextLabel} — ${o.label}` : o.label;
  if (o.src) {
    return h('button', { class: 'glass fdetail-media fdetail-media--img', type: 'button', 'aria-label': `Expand ${o.label}`,
      onclick: () => openModal('Evidence', title,
        h('div', { class: 'modal-media modal-media--img' }, h('img', { src: o.src, alt: o.label }))) },
      h('img', { class: 'fdetail-img', src: o.src, alt: o.label, loading: 'lazy' }),
      h('span', { class: 'fdetail-media-hint' }, '⤢ Click to expand'));
  }
  return h('button', { class: 'glass fdetail-media', type: 'button', 'aria-label': 'Expand image',
    onclick: () => openModal('Evidence', title, h('div', { class: 'modal-media' }, h('span', {}, o.label))) },
    h('span', {}, o.label),
    h('span', { class: 'fdetail-media-hint' }, '⤢ Click to expand'));
}

function findingsDetail(sets) {
  let si = 0, ti = 0;
  const switchWrap = h('div', { class: 'setswitch', role: 'tablist', 'aria-label': 'Journey stage' });
  const mediaWrap = h('div', { class: 'fdetail-media-wrap' });
  const tabsWrap = h('div', { class: 'fdetail-tabs', role: 'tablist', 'aria-label': 'Finding type' });
  const stackWrap = h('div', { class: 'fdetail-stack' });

  function renderMedia(set) {
    if (set.images.length <= 1) {
      mediaWrap.replaceChildren(mediaButton(set.images[0] || 'Image / screenshot', `${set.label} — ${set.images[0] || ''}`));
      return;
    }
    let ci = 0;
    const stage = h('div', { class: 'imgcar-stage' });
    const cap = h('span', { class: 'imgcar-cap' });
    const dots = h('div', { class: 'imgcar-dots' });
    const draw = () => {
      stage.replaceChildren(mediaButton(set.images[ci], `${set.label} — ${set.images[ci]}`));
      cap.textContent = `${ci + 1} / ${set.images.length}`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === ci));
    };
    set.images.forEach((_, k) => dots.append(h('button', { class: 'imgcar-dot', type: 'button',
      'aria-label': `Image ${k + 1}`, onclick: () => { ci = k; draw(); } })));
    const go = d => { ci = (ci + d + set.images.length) % set.images.length; draw(); };
    mediaWrap.replaceChildren(h('div', { class: 'imgcar' },
      stage,
      h('div', { class: 'imgcar-ctrl' },
        h('button', { class: 'imgcar-arrow', type: 'button', 'aria-label': 'Previous image', onclick: () => go(-1) }, '‹'),
        cap,
        h('button', { class: 'imgcar-arrow', type: 'button', 'aria-label': 'Next image', onclick: () => go(1) }, '›'),
        dots)));
    draw();
  }

  function renderStack(set) {
    const def = TAB_DEFS[ti];
    const items = set.tabs[def.key];
    const shown = items.slice(0, 6);
    const kids = [
      h('div', { class: 'fpanel-list' }, shown.length
        ? shown.map(def.render)
        : h('p', { class: 'fcol-empty' }, 'Nothing logged for this stage.')),
    ];
    if (items.length > 6) kids.push(h('p', { class: 'hpanel-more' }, `+ ${items.length - 6} more in the appendix`));
    stackWrap.replaceChildren(...kids);
  }

  function renderTabs(set) {
    ti = 0;
    const btns = TAB_DEFS.map((t, k) => {
      const b = h('button', { class: 'ftab', type: 'button', role: 'tab' },
        t.label, h('span', { class: 'ftab-count' }, String(set.tabs[t.key].length)));
      b.addEventListener('click', () => {
        ti = k;
        btns.forEach((x, j) => x.classList.toggle('on', j === k));
        renderStack(set);
      });
      return b;
    });
    btns[0].classList.add('on');
    tabsWrap.replaceChildren(...btns);
  }

  function renderSwitch() {
    switchWrap.replaceChildren(...sets.map((s, k) => {
      const b = h('button', { class: 'setbtn' + (k === si ? ' on' : ''), type: 'button', role: 'tab' }, s.label);
      b.addEventListener('click', () => {
        if (si === k) return;
        si = k; ti = 0;
        renderSwitch(); renderMedia(sets[si]); renderTabs(sets[si]); renderStack(sets[si]);
      });
      return b;
    }));
  }

  renderSwitch();
  renderMedia(sets[0]);
  renderTabs(sets[0]);
  renderStack(sets[0]);

  return h('div', { class: 'v3-wrap fdetail-wrap reveal' },
    switchWrap,
    h('div', { class: 'fdetail' }, mediaWrap, h('div', { class: 'fdetail-right' }, tabsWrap, stackWrap)));
}

/* ========================================================================== */
/* Candidate findings — journey stages (Pre / During / Post), evidence cards. */
/* Data: STAGES (built from the raw candidate tables). Card design per Figma:  */
/* Severity · Owner · Known  /  Heading  /  [Recommendation]  /  Source · Part */
/* ========================================================================== */
/* images: {label, src?} — src renders the real screenshot (fit, no crop);
   without src a labelled placeholder is shown. */
const CAND_STAGES = [
  { key: 'pre', label: 'Pre interview', images: [
    { label: 'Invite email', src: 'img/invite-email.png' },
    { label: 'Landing page', src: 'img/landing-page.png' }] },
  { key: 'during', label: 'During Interview', images: [
    { label: 'Conversational', src: 'img/conversational.png' },
    { label: 'Whiteboarding' }] },
  { key: 'post', label: 'Post interview', images: [{ label: 'Post interview' }] },
];
const REC_STAGES = [
  { key: 'scheduling', label: 'Scheduling', images: [{ label: 'Guide selection' }, { label: 'Customise & schedule' }] },
  { key: 'feedback', label: 'Feedback', images: [{ label: 'Feedback / output page' }, { label: 'Flagged activities' }] },
];
const SEV_RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const isUpfront = x => x.severity === 'P0' || x.severity === 'P1' || x.severity === 'P2';
const bySeverity = arr => [...arr].sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
const sevPill = sev => (sev ? h('span', { class: `tag sev-${sev.toLowerCase()}` }, sev) : null);
const metaText = parts => {
  const t = parts.filter(Boolean).join('  ·  ');
  return t ? h('span', { class: 'ev-metatext' }, t) : null;
};
/* card foot: Source · Participants (left) + KPI (bottom-right, blank if none) */
const evFoot = (parts, kpi) => h('div', { class: 'ev-foot' },
  h('span', { class: 'ev-foot-l' }, metaText(parts)),
  kpi ? h('span', { class: 'ev-kpi' }, kpi) : null);

function evModal(kicker, it) {
  openModal(kicker, it.heading || it.summary || 'Detail',
    h('div', { class: 'detail-block' },
      h('div', { class: 'tagrow', style: 'margin-top:18px' },
        sevTag(it.severity),
        (it.owner || it.area) ? ownerTag(it.owner || it.area) : null,
        it.known ? knownTag(it.known) : null,
        it.source ? trackTag(it.source) : null,
        it.issueArea ? trackTag(it.issueArea) : null),
      it.recommendation ? [h('span', { class: 'flabel' }, 'Recommendation'), h('p', {}, it.recommendation)] : [],
      it.evidence ? [h('span', { class: 'flabel' }, 'Evidence'), h('p', { class: 'lead' }, it.evidence)] : [],
      (it.participants || it.pain) ? [h('span', { class: 'flabel' }, it.participants ? 'Participants' : 'Pain point'), h('p', {}, it.participants || it.pain)] : []));
}

function evFindingCard(it, kicker) {
  return h('button', { class: 'glass ev-card', type: 'button', onclick: () => evModal(kicker, it) },
    h('div', { class: 'ev-meta' }, sevPill(it.severity), metaText([it.owner, it.known])),
    h('h4', { class: 'ev-heading' }, it.heading),
    evFoot([it.source, it.participants]));
}
function evWorksCard(it) {
  return h('button', { class: 'glass ev-card', type: 'button', onclick: () => evModal('What worked', it) },
    h('div', { class: 'ev-meta' }, metaText([it.owner, it.type])),
    h('h4', { class: 'ev-heading' }, it.heading),
    evFoot([it.source, it.participants]));
}
function evRecCard(it) {
  return h('button', { class: 'glass ev-card', type: 'button', onclick: () => evModal('Recommendation', it) },
    h('div', { class: 'ev-meta' }, sevPill(it.severity), metaText([it.area, it.issueArea])),
    h('h4', { class: 'ev-heading' }, it.summary || it.recommendation),
    (it.summary && it.recommendation) ? h('p', { class: 'ev-rec' }, it.recommendation) : null,
    evFoot([it.pain], it.kpi));
}

function stageFindings(dataByStage, stageDefs) {
  let si = 0, ti = 0;
  const TABS = [{ key: 'works', label: 'What worked' }, { key: 'feedback', label: 'Feedback' }, { key: 'recs', label: 'Recommendation' }];
  const switchWrap = h('div', { class: 'setswitch', role: 'tablist', 'aria-label': 'Journey stage' });
  const mediaWrap = h('div', { class: 'fdetail-media-wrap' });
  const tabsWrap = h('div', { class: 'fdetail-tabs', role: 'tablist', 'aria-label': 'Finding type' });
  const stackWrap = h('div', { class: 'fdetail-stack' });

  function renderMedia(meta) {
    const imgs = meta.images;
    if (imgs.length <= 1) { mediaWrap.replaceChildren(mediaButton(imgs[0], meta.label)); return; }
    let ci = 0;
    const stageEl = h('div', { class: 'imgcar-stage' });
    const cap = h('span', { class: 'imgcar-cap' });
    const dots = h('div', { class: 'imgcar-dots' });
    const draw = () => {
      stageEl.replaceChildren(mediaButton(imgs[ci], meta.label));
      cap.textContent = `${ci + 1} / ${imgs.length}`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === ci));
    };
    imgs.forEach((_, k) => dots.append(h('button', { class: 'imgcar-dot', type: 'button', 'aria-label': `Image ${k + 1}`, onclick: () => { ci = k; draw(); } })));
    const go = d => { ci = (ci + d + imgs.length) % imgs.length; draw(); };
    mediaWrap.replaceChildren(h('div', { class: 'imgcar' }, stageEl,
      h('div', { class: 'imgcar-ctrl' },
        h('button', { class: 'imgcar-arrow', type: 'button', 'aria-label': 'Previous image', onclick: () => go(-1) }, '‹'),
        cap,
        h('button', { class: 'imgcar-arrow', type: 'button', 'aria-label': 'Next image', onclick: () => go(1) }, '›'),
        dots)));
    draw();
  }

  function renderStack(meta) {
    const stage = dataByStage[meta.key];
    const def = TABS[ti];
    let cards = [], cta = null;
    if (def.key === 'works') {
      cards = stage.works.map(evWorksCard);
    } else if (def.key === 'feedback') {
      cards = bySeverity(stage.issues.filter(isUpfront)).map(it => evFindingCard(it, 'Feedback'));
      if (stage.issues.length) cta = h('button', { class: 'ev-viewall', type: 'button',
        onclick: () => openPanel(`${meta.label} · Feedback`, 'All feedback',
          explorer(stage.issues, {
            facets: [['Severity', 'severity'], ['Owner', 'owner'], ['Status', 'known'], ['Source', 'source']],
            render: v => h('div', { class: 'ev-list' }, v.map(it => evFindingCard(it, 'Feedback'))) })) },
        `View all ${stage.issues.length} →`);
    } else {
      cards = bySeverity(stage.recs.filter(isUpfront)).map(evRecCard);
      if (stage.recs.length) cta = h('button', { class: 'ev-viewall', type: 'button',
        onclick: () => openPanel(`${meta.label} · Recommendations`, 'All recommendations',
          explorer(stage.recs, {
            facets: [['Severity', 'severity'], ['Product area', 'area'], ['Issue area', 'issueArea']],
            render: v => h('div', { class: 'ev-list' }, v.map(evRecCard)) })) },
        `View all ${stage.recs.length} →`);
    }
    stackWrap.replaceChildren(...[
      h('div', { class: 'ev-list' }, cards.length ? cards : h('p', { class: 'fcol-empty' }, 'Nothing logged for this stage.')),
      cta,
    ].filter(Boolean));
  }

  function renderTabs(meta) {
    const stage = dataByStage[meta.key];
    const counts = { works: stage.works.length, feedback: stage.issues.length, recs: stage.recs.length };
    ti = 0;
    const btns = TABS.map((t, k) => {
      const b = h('button', { class: 'ftab', type: 'button', role: 'tab' }, t.label, h('span', { class: 'ftab-count' }, String(counts[t.key])));
      b.addEventListener('click', () => { ti = k; btns.forEach((x, j) => x.classList.toggle('on', j === k)); renderStack(meta); });
      return b;
    });
    btns[0].classList.add('on');
    tabsWrap.replaceChildren(...btns);
  }

  function renderSwitch() {
    switchWrap.replaceChildren(...stageDefs.map((s, k) => {
      const b = h('button', { class: 'setbtn' + (k === si ? ' on' : ''), type: 'button', role: 'tab' }, s.label);
      b.addEventListener('click', () => {
        if (si === k) return;
        si = k; ti = 0;
        renderSwitch(); renderMedia(stageDefs[si]); renderTabs(stageDefs[si]); renderStack(stageDefs[si]);
      });
      return b;
    }));
  }

  renderSwitch();
  renderMedia(stageDefs[0]);
  renderTabs(stageDefs[0]);
  renderStack(stageDefs[0]);

  return h('div', { class: 'v3-wrap fdetail-wrap reveal' },
    switchWrap,
    h('div', { class: 'fdetail' }, mediaWrap, h('div', { class: 'fdetail-right' }, tabsWrap, stackWrap)));
}

function v3Page() {
  const c = V2[v2track];
  const rows = RAW_BY_TRACK[v2track];

  const hero = h('section', { class: 'section v3-sec v3-hero', id: 'v3-agenda' },
    h('div', { class: 'v3-wrap' },
      h('p', { class: 'section-kicker reveal' }, V2.deckTitle),
      h('p', { class: 'section-sub deck-eyebrow reveal' }, c.deckSub),
      h('h1', { class: 'v3-hero-title reveal' }, c.hero.lead, h('span', { class: 'emph' }, c.hero.emph), c.hero.tail),
      h('div', { class: 'reveal' },
        h('h3', { class: 'mini-title' }, 'Agenda'),
        h('ol', { class: 'agenda-list v3-agenda-list' }, c.agenda.map(t => h('li', {}, h('span', {}, t))))),
    ));

  const goals = v3Sec('v3-goals', 'Context · 01', 'Goals of the research', null,
    h('div', { class: 'reveal' }, c.goals.map(g => h('p', { class: 'v3-goal-hero' }, g))));

  const personas = v3Sec('v3-personas', 'Context · 02', 'Personas considered', PERSONA_HINT[v2track],
    h('div', { class: 'v3-cards reveal' }, c.personas.map(p =>
      h('div', { class: `glass v3-persona pslide--${p.key.toLowerCase()}` },
        h('span', { class: 'pslide-count' }, p.count),
        h('h4', {}, p.name),
        p.facts
          ? h('ul', { class: 'persona-facts' }, p.facts.map(f =>
              h('li', {}, h('b', {}, `${f.label}: `), f.value)))
          : [p.role ? h('p', { class: 'pslide-role' }, p.role) : null,
             p.watch ? h('p', { class: 'pslide-watch' }, p.watch) : null],
        h('div', { class: 'pslide-viz' })))));

  const coverage = v3Sec('v3-coverage', 'Context · 03', 'Coverage — what we probed', null,
    h('div', { class: 'v3-cards v3-cards--cov reveal' }, c.coverage.map((cov, i) =>
      h('div', { class: 'glass v3-cov' },
        h('span', { class: 'coverage-step' }, `Stage ${i + 1}`),
        h('h4', {}, cov.stage),
        h('p', {}, cov.summary)))));

  const tk = c.takeaways;
  const takeawayCards = h('div', { class: 'v3-takeaways reveal' }, tk.cards.map((card, i) =>
    h('div', { class: 'glass v3-takeaway' },
      h('span', { class: 'v3-takeaway-num' }, `0${i + 1}`),
      h('h4', {}, card.title),
      h('p', {}, card.body))));

  const findings = h('section', { class: 'section v3-sec', id: 'v3-findings' },
    h('div', { class: 'v3-wrap' },
      h('div', { class: 'reveal v3-head' },
        h('p', { class: 'section-kicker' }, 'Findings'),
        h('h2', { class: 'section-title' }, tk.title),
        h('p', { class: 'section-sub' }, tk.subtext)),
      takeawayCards),
    v2track === 'candidate'
      ? stageFindings(STAGES.candidate, CAND_STAGES)
      : stageFindings(STAGES.recruiter, REC_STAGES));

  const appendix = v3Sec('v3-appendix', 'Appendix', 'Raw research log',
    `Every logged ${v2track} observation (${rows.length} rows). Search or filter.`,
    explorer(rows, {
      facets: [['Source', 'source'], ['Severity', 'severity'], ['Type', 'type'], ['Owner', 'owner']],
      render: v => h('div', { class: 'v3-rows' }, v.map(v3AppendixRow)),
    }));

  return [hero, goals, personas, coverage, findings, appendix];
}

function renderV3Subnav() {
  subnav.replaceChildren(...V3_SECTIONS.map(([id, label], i) =>
    h('a', { href: `#${id}`, class: i === 0 ? 'active' : '' }, label)));
}

let v3Cleanup = null;
function wireV3Scroll() {
  const reveals = [...document.querySelectorAll('.v3-sec .reveal')];
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  reveals.forEach(el => io.observe(el));
  // fallback: reveal anything already within the viewport on init (and if IO is flaky)
  const revealInView = () => reveals.forEach(el => {
    if (el.classList.contains('in')) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.94 && r.bottom > 0) el.classList.add('in');
  });
  revealInView();

  const toTop = document.getElementById('to-top');
  function onScroll() {
    toTop.classList.toggle('show', window.scrollY > 600);
    revealInView();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  observeSections();

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

function renderV3() {
  document.querySelector('.site-header').classList.remove('is-v2');
  document.querySelectorAll('.tab').forEach(t =>
    t.setAttribute('aria-selected', String(t.dataset.route === v2track)));
  app.replaceChildren(...v3Page());
  renderV3Subnav();
  v3Cleanup = wireV3Scroll();
  window.scrollTo({ top: 0 });
}

/* ------------------------------- routing ---------------------------------- */
const PAGES = { candidate: candidatePage, recruiter: recruiterPage };

function renderSubnav() {
  subnav.replaceChildren(...SECTIONS.map(([id, label], i) =>
    h('a', { href: `#${id}`, class: i === 0 ? 'active' : '' }, label)));
}

function observeSections() {
  const links = [...subnav.querySelectorAll('a')];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach(a => a.classList.toggle('active',
        a.getAttribute('href') === `#${entry.target.id}`));
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.section').forEach(s => observer.observe(s));
}

/* ---- routing — v3 is the only view ---- */
function route() {
  document.body.classList.add('v3');
  document.querySelector('.site-header').classList.remove('is-v2');
  if (v3Cleanup) { v3Cleanup(); v3Cleanup = null; }
  renderV3();
}

document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => {
    if (v2track !== t.dataset.route) { v2track = t.dataset.route; route(); }
  }));
document.getElementById('to-top').addEventListener('click', () =>
  window.scrollTo({ top: 0, behavior: 'smooth' }));

/* condense the global header once the page is scrolled */
const onHeaderScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onHeaderScroll, { passive: true });
onHeaderScroll();

/* ------------------------------- footer ----------------------------------- */
document.getElementById('footer-meta').append(
  h('div', {},
    `Sources (rendered as-is): `,
    h('code', {}, UXR.meta.sources.join(' · ')),
    h('br'),
    `Folder: `, h('code', {}, UXR.meta.sourceFolder),
    ` · Data generated ${UXR.meta.generatedAt} · ${UXR.meta.note}`,
  ));

route();
