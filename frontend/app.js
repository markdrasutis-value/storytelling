/* Story Engine — mobile KPI entry + story generation UI */

const API = '';  // same-origin
let sectors = {};
let customers = [];
let selectedKpis = new Set();
let currentWAText = '';

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function init() {
  await Promise.all([loadSectors(), loadCustomers()]);
  initTabs();
  initForm();
  renderCustomers();
  initStoryTab();
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function get(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || r.statusText);
  }
  return r.json();
}

// ── Data ───────────────────────────────────────────────────────────────────

async function loadSectors() {
  sectors = await get('/api/sectors');
  const sel = q('#sector');
  Object.entries(sectors).forEach(([k, v]) => {
    sel.append(opt(k, v.label));
  });
}

async function loadCustomers() {
  customers = await get('/api/customers');
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function initTabs() {
  qAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      qAll('.tab').forEach(t => t.classList.remove('active'));
      qAll('.pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      q(`#tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'customers') renderCustomers();
      if (tab.dataset.tab === 'story') refreshStorySelect();
    });
  });

  q('#refreshBtn').addEventListener('click', async () => {
    await loadCustomers();
    renderCustomers();
    refreshStorySelect();
    toast('Refreshed');
  });
}

// ── KPI form ───────────────────────────────────────────────────────────────

function initForm() {
  q('#sector').addEventListener('change', () => {
    selectedKpis.clear();
    renderKpiGrid();
    renderTags();
  });

  q('#addCustomKpiBtn').addEventListener('click', addCustomKpi);
  q('#customKpiInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomKpi(); }
  });

  q('#kpiForm').addEventListener('submit', async e => {
    e.preventDefault();
    await saveCustomer();
  });
}

function addCustomKpi() {
  const inp = q('#customKpiInput');
  const kpi = inp.value.trim().toLowerCase();
  if (!kpi) return;
  selectedKpis.add(kpi);
  renderTags();
  inp.value = '';
}

function renderKpiGrid() {
  const sector = q('#sector').value;
  const field = q('#kpiField');
  const customField = q('#customKpiField');
  const grid = q('#kpiGrid');
  grid.innerHTML = '';

  if (!sector || !sectors[sector]) {
    field.hidden = true;
    customField.hidden = true;
    return;
  }

  field.hidden = false;
  customField.hidden = false;

  sectors[sector].kpis.forEach(kpi => {
    const id = `cb-${kpi.replace(/\W+/g, '-')}`;
    const wrap = el('div', 'kpi-cb');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.value = kpi;
    cb.checked = selectedKpis.has(kpi);
    cb.addEventListener('change', () => {
      cb.checked ? selectedKpis.add(kpi) : selectedKpis.delete(kpi);
      renderTags();
    });
    const lbl = el('label');
    lbl.htmlFor = id;
    lbl.textContent = kpi;
    wrap.append(cb, lbl);
    grid.append(wrap);
  });
}

function renderTags() {
  const row = q('#selectedKpis');
  row.innerHTML = '';
  selectedKpis.forEach(kpi => {
    const tag = el('div', 'tag');
    tag.innerHTML = `${esc(kpi)}<button aria-label="Remove ${esc(kpi)}">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      selectedKpis.delete(kpi);
      const cb = q(`#cb-${kpi.replace(/\W+/g, '-')}`);
      if (cb) cb.checked = false;
      renderTags();
    });
    row.append(tag);
  });
}

async function saveCustomer() {
  const name = q('#customerName').value.trim();
  const sector = q('#sector').value;
  const company_size = q('#companySize').value || null;
  const region = q('#region').value || null;
  const kpis = [...selectedKpis];

  if (!name || !sector) { toast('Enter a customer name and sector'); return; }
  if (!kpis.length)      { toast('Select at least one KPI'); return; }

  const btn = q('#saveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await post('/api/customers', { name, sector, kpis, company_size, region });
    await loadCustomers();
    toast(`Saved profile for ${name}`);
    resetForm();
    // Switch to Customers tab
    qAll('.tab')[1].click();
  } catch (err) {
    toast('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Profile';
  }
}

function resetForm() {
  q('#kpiForm').reset();
  selectedKpis.clear();
  q('#kpiField').hidden = true;
  q('#customKpiField').hidden = true;
  q('#kpiGrid').innerHTML = '';
  renderTags();
}

// ── Customer list ──────────────────────────────────────────────────────────

function renderCustomers() {
  const container = q('#customerList');
  container.innerHTML = '';

  if (!customers.length) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<p>No customers yet.</p><p>Add one using the form.</p>';
    container.append(empty);
    return;
  }

  const sorted = [...customers].sort((a, b) =>
    (b.updated_at || '').localeCompare(a.updated_at || '')
  );

  sorted.forEach(c => {
    const sectorLabel = sectors[c.sector]?.label || c.sector;
    const kpiPreview  = c.kpis.slice(0, 3).join(', ') +
      (c.kpis.length > 3 ? ` +${c.kpis.length - 3}` : '');
    const meta = [sectorLabel, c.company_size, c.region].filter(Boolean).join(' · ');

    const item = el('div', 'customer-item');
    item.innerHTML = `
      <div class="customer-info">
        <div class="customer-name">${esc(c.name)}</div>
        <div class="customer-meta">${esc(meta)}</div>
        <div class="customer-kpis">${esc(kpiPreview)}</div>
      </div>
      <button class="story-pill" data-name="${esc(c.name)}">Story</button>
    `;
    item.querySelector('.story-pill').addEventListener('click', () => jumpToStory(c.name));
    container.append(item);
  });
}

function jumpToStory(name) {
  qAll('.tab')[2].click();
  q('#storyCustomerSelect').value = name;
}

// ── Story tab ──────────────────────────────────────────────────────────────

function initStoryTab() {
  q('#generateBtn').addEventListener('click', runGenerate);
  q('#copyWABtn').addEventListener('click', () => {
    navigator.clipboard.writeText(currentWAText).then(() => toast('Copied for WhatsApp'));
  });
  q('#copyTextBtn').addEventListener('click', () => {
    const text = q('#storyBody').innerText;
    navigator.clipboard.writeText(text).then(() => toast('Copied'));
  });
}

function refreshStorySelect() {
  const sel = q('#storyCustomerSelect');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select customer…</option>';
  customers.forEach(c => sel.append(opt(c.name, c.name)));
  if (prev) sel.value = prev;
}

async function runGenerate() {
  const customer = q('#storyCustomerSelect').value;
  if (!customer) { toast('Select a customer first'); return; }

  hide('#storyCard');
  hide('#storyError');
  show('#storyLoading');
  q('#generateBtn').disabled = true;

  try {
    const story = await post('/api/story', { customer });
    renderStory(story);
    currentWAText = story.whatsapp_formatted;
    show('#storyCard');
  } catch (err) {
    q('#storyError').textContent = err.message;
    show('#storyError');
  } finally {
    hide('#storyLoading');
    q('#generateBtn').disabled = false;
  }
}

function renderStory(story) {
  const arc = story.story_arc;
  q('#storyTitle').textContent = `Story: ${story.customer}`;

  q('#storyBody').innerHTML = [
    section('The Context',       arc.situation),
    section('The Challenge',     arc.complication),
    section('What They Tried',   arc.rising_action),
    section('The Turning Point', arc.resolution),
    '<hr class="story-divider">',
    outcomes('Verified Outcomes',     arc.outcomes),
    section(`What This Means for ${esc(story.customer)}`, arc.so_what),
    outcomes('Indicative Outcomes',   arc.indicative_outcomes),
  ].join('');
}

function section(title, text) {
  return `<div class="story-section">
    <div class="section-label">${title}</div>
    <div class="section-text">${esc(text)}</div>
  </div>`;
}

function outcomes(title, list) {
  const items = list.map(o => `<li>${esc(o)}</li>`).join('');
  return `<div class="story-section">
    <div class="section-label">${title}</div>
    <ul class="outcome-list">${items}</ul>
  </div>`;
}

// ── Micro-utilities ────────────────────────────────────────────────────────

const q    = s => document.querySelector(s);
const qAll = s => document.querySelectorAll(s);
const el   = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const opt  = (val, lbl) => { const o = el('option'); o.value = val; o.textContent = lbl; return o; };
const show = s => { const e = q(s); if (e) e.hidden = false; };
const hide = s => { const e = q(s); if (e) e.hidden = true; };
const esc  = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

let _toastTimer;
function toast(msg) {
  const el = q('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Go ─────────────────────────────────────────────────────────────────────

init().catch(err => console.error('Init failed:', err));
