// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CONDITIONS = ["WT 10 we", "WT 10 mo", "WT 18 mo", "CSE-/- 10 we"];
const COMPARISONS = [
  ["WT 10 mo vs WT 10 we",      "WT 10 mo",    "WT 10 we"],
  ["WT 18 mo vs WT 10 we",      "WT 18 mo",    "WT 10 we"],
  ["WT 18 mo vs WT 10 mo",      "WT 18 mo",    "WT 10 mo"],
  ["CSE-/- 10 we vs WT 10 we",  "CSE-/- 10 we","WT 10 we"],
];

// Box colours that work on both dark and light backgrounds
// Dark: semi-transparent fills (look great on dark bg)
const BOX_COLORS_DARK = [
  'rgba(160,160,170,0.60)',
  'rgba(140,150,255,0.65)',
  'rgba(110,110,255,0.78)',
  'rgba(255,120,120,0.82)',
];
// Light: darker, more saturated fills (visible on white bg)
const BOX_COLORS_LIGHT = [
  'rgba(90,90,105,0.75)',
  'rgba(70,80,210,0.72)',
  'rgba(55,55,195,0.80)',
  'rgba(210,55,55,0.80)',
];

// ─── THEME ───────────────────────────────────────────────────────────────────
function getTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

function getPlotColors() {
  const dark = getTheme() === 'dark';
  return {
    text:       dark ? '#e6edf3'              : '#1a2332',
    muted:      dark ? '#ffffff'              : '#000000',  // white in dark, black in light
    grid:       dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    zeroline:   dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)',
    paper_bg:   'rgba(0,0,0,0)',
    plot_bg:    'rgba(0,0,0,0)',
    sig_star:   dark ? '#ffffff'              : '#000000',  // white stars on dark, black on light
    point_col:  dark ? '#ffffff'              : '#000000',  // fully opaque, no transparency
    box_colors: dark ? BOX_COLORS_DARK        : BOX_COLORS_LIGHT,
    box_border: dark ? '#ffffff'              : '#000000',  // white borders on dark, black on light
  };
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  updateToggleLabel();
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  updateToggleLabel();
  // Re-render all live plots
  if (typeof rerenderPlots === 'function') rerenderPlots();
}

function updateToggleLabel() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.innerHTML = getTheme() === 'dark'
    ? '☀️ Light mode'
    : '🌙 Dark mode';
}

// ─── SIGNIFICANCE ─────────────────────────────────────────────────────────────
function sigSymbol(p) {
  if (p === null || p === undefined || isNaN(p)) return '';
  if (p < 0.001) return '***';
  if (p < 0.01)  return '**';
  if (p < 0.05)  return '*';
  return '';
}

function mean(arr) {
  if (!arr || arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ─── PLOTLY BOXPLOT ───────────────────────────────────────────────────────────

// ─── COMPUTE PLOT HEIGHT (without rendering) ──────────────────────────────────
// Call for both PSOH and PSSH, take max, pass as forceHeight to synchronise them.
function calcPlotHeight(protData) {
  if (!protData || !protData.conditions) return 400;
  let allVals = [];
  CONDITIONS.forEach(c => { allVals = allVals.concat(protData.conditions[c] || []); });
  let sigCount = 0;
  COMPARISONS.forEach(([label]) => { if (sigSymbol((protData.pvals || {})[label])) sigCount++; });
  return 400 + sigCount * 90;
}

function buildBoxplot(containerId, protData, forceHeight) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!protData || !protData.conditions) {
    el.innerHTML = '<div class="no-data">No data available</div>';
    return;
  }

  const C = getPlotColors();

  const traces = CONDITIONS.map((cond, i) => {
    const vals = protData.conditions[cond] || [];
    const fillCol = C.box_colors[i];
    const lineCol = C.box_border || fillCol;
    return {
      type: 'box', name: cond, y: vals,
      marker:    { color: C.point_col, size: 10, line: { width: 0 } },
      line:      { color: lineCol, width: 1 },
      fillcolor:  fillCol,
      boxpoints: 'all', jitter: 0.38, pointpos: 0, whiskerwidth: 0.55, showlegend: false,
    };
  });

  let allVals = [];
  CONDITIONS.forEach(c => { allVals = allVals.concat(protData.conditions[c] || []); });
  const maxY = allVals.length ? Math.max(...allVals) : 1;
  const minY = allVals.length ? Math.min(...allVals) : 0;
  const range = maxY - minY || 1;

  const condIdx = { "WT 10 we": 0, "WT 10 mo": 1, "WT 18 mo": 2, "CSE-/- 10 we": 3 };
  const shapes = [], annotations = [];
  let sigCount = 0;

  COMPARISONS.forEach(([label, c1, c2]) => {
    const p   = (protData.pvals || {})[label];
    const sym = sigSymbol(p);
    if (!sym) return;
    const x1    = condIdx[c1], x2 = condIdx[c2];
    const baseY = maxY + range * 0.14 + sigCount * range * 0.30;
    const barH  = range * 0.05;
    shapes.push(
      { type:'line', xref:'x', yref:'y', x0:x1, y0:baseY,      x1:x1, y1:baseY+barH, line:{color:C.muted, width:1.5} },
      { type:'line', xref:'x', yref:'y', x0:x1, y0:baseY+barH, x1:x2, y1:baseY+barH, line:{color:C.muted, width:1.5} },
      { type:'line', xref:'x', yref:'y', x0:x2, y0:baseY+barH, x1:x2, y1:baseY,      line:{color:C.muted, width:1.5} }
    );
    annotations.push({
      x: (x1+x2)/2, y: baseY + barH + range * 0.11,
      xref:'x', yref:'y', text: sym, showarrow: false,
      font: { color: C.sig_star, size: 34, family: 'Arial' }
    });
    sigCount++;
  });

  const topY = maxY + range * 0.14 + sigCount * range * 0.30 + range * 0.40;

  // Use shared forceHeight if provided (PSOH/PSSH synchronisation), else compute own.
  const plotHeight = forceHeight || calcPlotHeight(protData);
  el.style.height  = plotHeight + 'px';

  const layout = {
    paper_bgcolor: C.paper_bg, plot_bgcolor: C.plot_bg,
    font: { color: C.text, family: "Arial, sans-serif" },
    yaxis: {
      title: { text: 'Log₂(intensity)', font: { size: 24, color: C.muted } },
      color: C.muted, gridcolor: C.grid, zerolinecolor: C.zeroline,
      range: [minY - range * 0.05, topY],
      tickfont: { size: 22, color: C.muted },
    },
    xaxis: {
      color: C.muted, tickangle: -25,
      tickfont: { size: 22, color: C.muted }, linecolor: C.grid,
    },
    shapes, annotations,
    margin: { t: 20, l: 90, r: 20, b: 110 },
    height: plotHeight - 4,
  };

  Plotly.react(containerId, traces, layout, { responsive: true, displayModeBar: false });
}


// ─── FC TABLE ─────────────────────────────────────────────────────────────────
function buildFCTable(containerId, protData) {
  if (!protData) { document.getElementById(containerId).innerHTML = ''; return; }
  const rows = COMPARISONS.map(([label, c1, c2]) => {
    const v1  = protData.conditions?.[c1] || [];
    const v2  = protData.conditions?.[c2] || [];
    const fc  = (v1.length && v2.length) ? mean(v1) - mean(v2) : NaN;
    const p   = protData.pvals?.[label] ?? null;
    const sym = sigSymbol(p);
    return { label, fc, p, sym };
  });

  document.getElementById(containerId).innerHTML = `
    <div class="fc-table-wrap">
      <table class="fc-table">
        <thead><tr>
          <th>Comparison</th><th>Log₂FC</th><th>Adj. p-value</th><th>Sig.</th>
        </tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${r.label}</td>
          <td class="${isNaN(r.fc)?'':r.fc>0?'fc-pos':'fc-neg'}">${isNaN(r.fc)?'—':r.fc.toFixed(3)}</td>
          <td>${r.p!==null?r.p.toFixed(4):'—'}</td>
          <td>${r.sym?`<span class="sig-star">${r.sym}</span>`:`<span class="sig-ns">ns</span>`}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ─── SWISSBIOPICS — direct SVG fetch (no web component) ──────────────────────
// Instead of using the <sib-swissbiopics-sl> web component (which relies on
// the remote server registering a custom element), we call the same API URL
// the component uses internally and inject the SVG ourselves.
// API: GET https://www.swissbiopics.org/api/{taxid}/sl/{sls}
//   taxid : NCBI taxonomy ID (10090 = mouse)
//   sls   : comma-separated bare integers, "SL-0091" → "91"

function slIdToParam(id) {
  // Strip "SL-" prefix and all leading zeros: "SL-0091" → "91"
  return id.replace(/^SL-0*/i, '') || '0';
}

async function fetchSwissBioPicsSVG(taxId, slIds) {
  // Safety guards — never build a URL with null/undefined values
  const safeTaxId = taxId && taxId !== 'null' ? taxId : 10090;  // default: Mus musculus
  const safeIds   = slIds.filter(id => id && id !== 'null').map(slIdToParam).filter(Boolean);
  if (!safeIds.length) throw new Error('No valid SL IDs');

  const sls = safeIds.join(',');
  const url = `https://www.swissbiopics.org/api/${safeTaxId}/sl/${sls}`;
  console.log('[SwissBioPics] fetching:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from SwissBioPics API`);
  const svg = await res.text();
  if (!svg.includes('<svg')) throw new Error('Response is not SVG');
  return svg;
}

// ─── UNIPROT FETCH ────────────────────────────────────────────────────────────
async function fetchUniProt(accession) {
  try {
    const res   = await fetch(`https://rest.uniprot.org/uniprotkb/${accession}.json`);
    if (!res.ok) return null;
    const entry = await res.json();
    const name = entry.proteinDescription?.recommendedName?.fullName?.value
              || entry.proteinDescription?.submissionNames?.[0]?.fullName?.value
              || accession;
    const org   = entry.organism?.scientificName || 'Unknown';
    // taxonId can be at different depths depending on UniProt API version
    const taxId = entry.organism?.taxonId
               || entry.organism?.taxonomy
               || 10090;   // hard fallback: Mus musculus (all proteins in this study are mouse)
    const gene  = entry.genes?.[0]?.geneName?.value || 'N/A';
    const acc2  = entry.primaryAccession || accession;

    // Log the full organism block so we can see the exact structure
    console.log('[UniProt] organism block:', JSON.stringify(entry.organism));

    let subloc = 'Not available', sublocFull = '', slIds = [], funcText = '';
    for (const c of entry.comments || []) {
      if (c.commentType === 'SUBCELLULAR LOCATION') {
        const locs = c.subcellularLocations || [];
        subloc     = locs[0]?.location?.value || subloc;
        sublocFull = locs.map(s => s.location?.value).filter(Boolean).join(' · ') || subloc;
        // Log the first location object so we can see its exact structure
        if (locs[0]) console.log('[UniProt] first subloc entry:', JSON.stringify(locs[0]));
        locs.forEach(s => {
          const id = s.location?.id || s.location?.evidences?.[0]?.id;
          if (id && id !== 'null') slIds.push(id);
        });
      }
      if (c.commentType === 'FUNCTION' && !funcText) funcText = c.texts?.[0]?.value || '';
    }
    slIds = [...new Set(slIds.filter(Boolean))];
    console.log(`[UniProt] ${acc2} subloc="${subloc}" slIds=[${slIds.join(',')}]`);
    const seqLen  = entry.sequence?.length   || null;
    const seqMass = entry.sequence?.molWeight || null;
    return { accession: acc2, name, organism: org, taxId, gene,
             subloc, sublocFull, slIds, funcText, seqLen, seqMass };
  } catch(e) { console.error('[UniProt] fetch error:', e); return null; }
}

// ─── COMPARTMENT ICON (text fallback) ────────────────────────────────────────
function compartmentIcon(subloc) {
  const map = {
    nucleus:'🔵', cytoplasm:'🟡', cytosol:'🟡', mitochondr:'🔴',
    membrane:'🟢', 'plasma membrane':'🟢', 'endoplasmic reticulum':'🟣',
    golgi:'🟠', lysosom:'🟤', peroxisom:'🔵', extracellular:'⚪', secreted:'⚪',
  };
  const low = (subloc || '').toLowerCase();
  for (const [k, v] of Object.entries(map)) { if (low.includes(k)) return v; }
  return '📍';
}

// ─── RENDER UNIPROT PANEL ─────────────────────────────────────────────────────
async function renderUniProtPanel(accession, containerElement) {
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  containerElement.innerHTML = `<div class="loading-text" style="margin-top:20px;">Fetching UniProt data…</div>`;
  const info = await fetchUniProt(accession);
  if (!info) {
    containerElement.innerHTML = `<div class="loading-text" style="margin-top:20px;">Could not load UniProt data for ${accession}.</div>`;
    return;
  }

  const icon   = compartmentIcon(info.subloc);
  const hasSBP = info.slIds && info.slIds.length > 0;

  containerElement.innerHTML = `
  <div style="margin-top:24px;">
    <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;">
      🔬 Protein Information
    </div>

    <!-- ── UniProt card — full width ── -->
    <div class="uniprot-rich-card" style="margin-bottom:20px;">
      <div class="uniprot-rich-header">
        <div>
          <div class="uniprot-protein-name" style="font-size:1.6rem;">${esc(info.name)}</div>
          <div class="uniprot-badges">
            <span class="badge badge-acc">🔑 ${esc(info.accession)}</span>
            ${info.gene && info.gene !== 'N/A' ? `<span class="badge badge-gene">🧬 ${esc(info.gene)}</span>` : ''}
            <span class="badge badge-org">🐭 ${esc(info.organism)}</span>
          </div>
          ${info.seqLen ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">
            ${info.seqLen} aa &nbsp;·&nbsp; ${info.seqMass ? (info.seqMass/1000).toFixed(1)+' kDa' : ''}
          </div>` : ''}
        </div>
        <a class="uniprot-link" href="https://www.uniprot.org/uniprotkb/${info.accession}" target="_blank">UniProt ↗</a>
      </div>

      <!-- Two-col inside: diagram left, metadata right -->
      <div class="uniprot-body">

        <!-- Subcellular diagram — taller now -->
        <div class="compartment-panel">
          <div>
            <div class="compartment-label">Subcellular localisation</div>
            <div class="compartment-pill" style="border:1px solid var(--border2);color:var(--text);background:var(--surface2);">
                <span style="font-size:14px;">${esc(info.sublocFull || info.subloc)}</span>
              </div>
          </div>

          <div class="subloc-image-wrap sbp-wrap" id="sbp-mount-${esc(info.accession)}" style="min-height:340px;">
            ${hasSBP
              ? `<div class="loading-text" style="padding:40px 0;">Loading localisation diagram…</div>`
              : `<div class="subloc-fallback">
                   <span style="font-size:48px;">${icon}</span>
                   <span>${esc(info.subloc)}</span>
                   <span style="font-size:11px;">No diagram available</span>
                 </div>`}
          </div>

          ${hasSBP ? `<div style="font-size:10px;color:var(--muted);text-align:right;margin-top:4px;">
            Diagram: <a href="https://www.swissbiopics.org" target="_blank" style="color:var(--muted);">SwissBioPics</a> (CC BY 4.0)
          </div>` : ''}
        </div>

        <!-- Metadata — full function text, no clamp -->
        <div class="uniprot-meta-panel">
          ${info.funcText ? `<div class="meta-item">
            <span class="meta-label">Function</span>
            <span style="font-size:14px;color:var(--text);line-height:1.65;">${esc(info.funcText)}</span>
          </div>` : ''}
          <div class="meta-item">
            <span class="meta-label">Organism</span>
            <span class="meta-value" style="font-size:14px;">${esc(info.organism)}</span>
          </div>
          ${info.seqLen ? `<div class="meta-item">
            <span class="meta-label">Sequence</span>
            <span class="meta-value" style="font-size:14px;">${info.seqLen} aa${info.seqMass ? ' · '+(info.seqMass/1000).toFixed(1)+' kDa' : ''}</span>
          </div>` : ''}
          <div class="meta-item" style="margin-top:auto;padding-top:16px;">
            <a class="uniprot-link" style="font-size:13px;padding:7px 16px;width:fit-content;"
               href="https://www.uniprot.org/uniprotkb/${info.accession}" target="_blank">
              🔗 Full UniProt entry
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- ── AlphaFold card — full width ── -->
    <div class="alphafold-card">
      <div class="af-header">
        <span class="af-title" style="font-size:1.2rem;">🧩 AlphaFold 3D Structure — ${esc(info.name)}</span>
        <a class="uniprot-link" style="font-size:12px;padding:5px 12px;"
           href="https://alphafold.ebi.ac.uk/entry/${info.accession}" target="_blank">Open ↗</a>
      </div>
      <iframe src="https://alphafold.ebi.ac.uk/entry/${info.accession}"
              style="height:560px;"
              title="AlphaFold 3D structure" loading="lazy" allowfullscreen></iframe>
    </div>

  </div>`;

  if (!hasSBP) return;

  const mount = document.getElementById(`sbp-mount-${info.accession}`);
  if (!mount) return;

  // Try all SL IDs together first, then fall back to just the primary one,
  // then give up gracefully.
  const attempts = [
    info.slIds,                // all locations combined
    [info.slIds[0]],           // primary location only
  ];

  let svgHtml = null;
  for (const ids of attempts) {
    try {
      svgHtml = await fetchSwissBioPicsSVG(info.taxId, ids);
      console.log(`[SwissBioPics] success with sls=${ids.map(slIdToParam).join(',')}`);
      break;
    } catch(e) {
      console.warn(`[SwissBioPics] failed with sls=${ids.map(slIdToParam).join(',')}: ${e.message}`);
    }
  }

  if (svgHtml) {
    // Inject the SVG directly
    mount.innerHTML = `<div class="sbp-svg-wrap" style="width:100%;line-height:0;">${svgHtml}</div>`;

    const svg = mount.querySelector('svg');
    if (svg) {
      // Make SVG responsive
      svg.style.width    = '100%';
      svg.style.height   = 'auto';
      svg.style.maxHeight = '380px';
      svg.removeAttribute('width');
      svg.removeAttribute('height');

      // ── Highlight matching compartments ──────────────────────────────────
      // The SVG uses id="SL0091" (no dash). We add class "subcell_present"
      // to each matching element, exactly as the web component does.
      info.slIds.forEach(rawId => {
        const svgId = rawId.replace('-', '');   // "SL-0091" → "SL0091"
        const el = svg.getElementById(svgId);
        if (el) {
          el.classList.add('subcell_present');
          console.log(`[SwissBioPics] highlighted #${svgId}`);
        } else {
          // Also try mp_ (membrane part) and part_ prefixes
          svg.querySelectorAll(`.mp_${svgId}, .part_${svgId}`).forEach(el => {
            el.classList.add('subcell_present');
          });
        }
      });

      // ── Inject highlight CSS (copied from the web component source) ───────
      const style = document.createElement('style');
      style.textContent = `
        .sbp-svg-wrap .subcell_present *:not(text) {
          fill: orange;
          fill-opacity: 0.55;
        }
        .sbp-svg-wrap .subcell_present .coloured {
          stroke: #c45000;
        }
        .sbp-svg-wrap svg .subcellular_location:hover *:not(text) {
          fill: red;
          fill-opacity: 0.65;
          cursor: pointer;
        }
      `;
      mount.appendChild(style);
    }
  } else {
    mount.innerHTML = `<div class="subloc-fallback">
      <span style="font-size:40px;">${icon}</span>
      <span>${esc(info.sublocFull || info.subloc)}</span>
      <span style="font-size:11px;">Diagram not available for this entry</span>
    </div>`;
  }
}

// ─── BANNER ───────────────────────────────────────────────────────────────────
function renderBanner() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.body.insertAdjacentHTML('afterbegin', `
    <div id="top-banner">
      <img class="banner-logo" src="assets/logo_left.jpg" alt="Lab logo">
      <div class="banner-title">Age-Dependent Dynamics of<br>Protein Persulfidation and Sulfenylation</div>
      <img class="banner-logo" src="assets/logo_right_dark.png" alt="Lab logo" id="banner-logo-right">
    </div>
    <nav id="top-nav">
      <a href="index.html"       class="${page==='index.html'      ?'active':''}">🧬 Protein Search</a>
      <a href="correlation.html" class="${page==='correlation.html'?'active':''}">📊 PTM Correlation</a>
      <a href="contact.html"     class="${page==='contact.html'    ?'active':''}">📬 Contact</a>
      <span class="nav-spacer"></span>
      <button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()">☀️ Light mode</button>
      <button class="study-btn" onclick="openStudyPopup()">📘 Study Summary</button>
    </nav>`);

  initTheme();          // apply saved theme + correct button label
  updateLogos();        // swap logos if needed
}

// Swap banner logos to match theme
function updateLogos() {
  const right = document.getElementById('banner-logo-right');
  if (!right) return;
  right.src = getTheme() === 'dark' ? 'assets/logo_right_dark.png' : 'assets/logo_right_light.png';
}

// Patch toggleTheme to also swap logos
const _origToggle = toggleTheme;
// eslint-disable-next-line no-global-assign
toggleTheme = function() {
  _origToggle();
  updateLogos();
};

// ─── STUDY POPUP ─────────────────────────────────────────────────────────────
const POPUP_HTML = `
<div id="study-overlay" onclick="if(event.target===this)closeStudyPopup()">
  <div id="study-box">
    <button id="study-close" onclick="closeStudyPopup()">×</button>
    <h2>🧪 Study Overview</h2>
    <p>This interactive platform explores and visualizes protein redox modifications
       (sulfenylation &amp; persulfidation) across aging and in CSE-deficient mice brain.</p>
    <p>We investigate how protein sulfenylation (PSOH) and persulfidation (PSSH) change
       in the frontal cortex of wild-type mice at 10 weeks (10 we), 10 months (10 mo),
       and 18 months (18 mo).</p>
    <p>CSE (<em>Cth</em>) is responsible for H₂S production, a gasotransmitter involved
       in the formation of protein persulfidation. Mice lacking CSE showed decreased
       lifespan and increased susceptibility to neurodegeneration. Here we compared WT
       and CSE<sup>−/−</sup> mice at 10 weeks to understand how PSOH and PSSH changes
       contribute to premature aging and neurodegeneration.</p>
    <p><strong>Experimental workflow:</strong></p>
    <ul>
      <li>Sulfenylation (PSOH) enrichment adapted from
          <a href="https://currentprotocols.onlinelibrary.wiley.com/doi/10.1002/cpps.76" target="_blank">Fu et al.</a>
          (Curr Protoc Protein Sci., 2019)</li>
      <li>Persulfidation (PSSH) enrichment from
          <a href="https://www.cell.com/cell-metabolism/fulltext/S1550-4131(19)30562-5" target="_blank">Zivanovic et al.</a>
          (Cell Metab., 2019)</li>
      <li>Samples quantified using label-free quantification (LFQ)</li>
    </ul>
    <p class="close-hint">Click outside this box or press Esc to close.</p>
  </div>
</div>`;

function renderStudyPopup() {
  document.body.insertAdjacentHTML('beforeend', POPUP_HTML);
  if (sessionStorage.getItem('popupShown')) closeStudyPopup(false);
}
function openStudyPopup()  { document.getElementById('study-overlay')?.classList.remove('hidden'); }
function closeStudyPopup() {
  document.getElementById('study-overlay')?.classList.add('hidden');
  sessionStorage.setItem('popupShown', '1');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStudyPopup(); });
