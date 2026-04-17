'use strict';

/**
 * Story Intelligence — sector inference, stage resolution, KPI + capability mapping.
 * No external API calls. All resolution is deterministic from training knowledge.
 */

// ── Known companies (extend as needed) ────────────────────────────────────────
const KNOWN_COMPANIES = {
  // Superapps
  grab: 'superapp', gojek: 'superapp', gopay: 'superapp',
  ovo: 'superapp', dana: 'superapp', kakaopay: 'superapp',

  // Fintech / banking
  dbs: 'fintech', ocbc: 'fintech', uob: 'fintech',
  anz: 'fintech', nab: 'fintech', westpac: 'fintech', cba: 'fintech',
  commbank: 'fintech', macquarie: 'fintech',
  monzo: 'fintech', revolut: 'fintech', starling: 'fintech',
  nubank: 'fintech', chime: 'fintech', wise: 'fintech',
  stripe: 'fintech', adyen: 'fintech', afterpay: 'fintech',
  klarna: 'fintech', gocardless: 'fintech',
  paytm: 'fintech', phonepe: 'fintech', gpay: 'fintech',

  // E-commerce / retail
  kmart: 'ecommerce', officeworks: 'ecommerce', bunnings: 'ecommerce',
  woolworths: 'ecommerce', coles: 'ecommerce', bigw: 'ecommerce',
  target: 'ecommerce', myer: 'ecommerce', davidjones: 'ecommerce',
  shopee: 'ecommerce', lazada: 'ecommerce', tokopedia: 'ecommerce',
  bukalapak: 'ecommerce', tiki: 'ecommerce', sendo: 'ecommerce',
  amazon: 'ecommerce', ebay: 'ecommerce', etsy: 'ecommerce',
  zalora: 'ecommerce', asos: 'ecommerce', shein: 'ecommerce',

  // SaaS / tech
  canva: 'saas', atlassian: 'saas', xero: 'saas', seek: 'saas',
  salesforce: 'saas', hubspot: 'saas', zendesk: 'saas',
  slack: 'saas', notion: 'saas', figma: 'saas',

  // Media / entertainment
  spotify: 'media', netflix: 'media', disney: 'media',
  nineentertainment: 'media', nine: 'media', news: 'media',
  smg: 'media', foxtel: 'media', binge: 'media',

  // Travel
  airbnb: 'travel', booking: 'travel', expedia: 'travel',
  qantas: 'travel', virginaustralia: 'travel', tigerair: 'travel',
  agoda: 'travel', traveloka: 'travel',

  // Telco
  telstra: 'telco', optus: 'telco', vodafone: 'telco',
  singtel: 'telco', starhub: 'telco', maxis: 'telco', celcom: 'telco',
  digi: 'telco', true: 'telco', ais: 'telco',

  // Health
  medibank: 'health', nib: 'health', bupa: 'health',
  halodoc: 'health', alodokter: 'health',
};

// ── Keyword fallback ───────────────────────────────────────────────────────────
const SECTOR_KEYWORDS = {
  fintech:   ['bank', 'pay', 'finance', 'financial', 'lending', 'credit', 'invest', 'insurance', 'wallet', 'money', 'cash', 'fund'],
  ecommerce: ['shop', 'store', 'retail', 'market', 'mall', 'buy', 'commerce', 'direct'],
  media:     ['media', 'news', 'stream', 'music', 'video', 'content', 'entertainment', 'broadcast', 'publish'],
  saas:      ['soft', 'tech', 'cloud', 'platform', 'digital', 'data', 'api', 'dev', 'app'],
  travel:    ['travel', 'hotel', 'air', 'flight', 'book', 'stay', 'tourism', 'holiday', 'tour'],
  telco:     ['telco', 'telecom', 'mobile', 'network', 'wireless', 'broadband', 'connect', 'tel'],
  health:    ['health', 'medical', 'care', 'clinic', 'pharma', 'wellness', 'hospital', 'med'],
  superapp:  ['super', 'omni', 'multi'],
};

// ── Default stage per sector ───────────────────────────────────────────────────
const DEFAULT_STAGE = {
  ecommerce: 'Acquisition',
  travel:    'Acquisition',
  fintech:   'Retention',
  superapp:  'Activation',
  saas:      'Activation',
  media:     'Retention',
  telco:     'Monetisation',
  health:    'Retention',
};

// ── Stage → KPIs + Amplitude capabilities ─────────────────────────────────────
const STAGE_MAP = {
  Acquisition: {
    kpis:         ['Funnel conversion', 'Drop-off rate', 'CAC'],
    capabilities: ['Funnel analysis', 'Cohort comparison', 'Pathfinder'],
    benchmarks: [
      'Funnel conversion uplift: +18–30%',
      'Funnel drop-off reduction: 20–40%',
    ],
  },
  Activation: {
    kpis:         ['Time to first value', 'Feature adoption', 'Onboarding completion'],
    capabilities: ['Guides & Surveys', 'Session replay', 'User journeys'],
    benchmarks: [
      'Time to first value: 30–50% faster',
      'Feature adoption uplift: +25–45%',
      'Onboarding completion: +20–35%',
    ],
  },
  Retention: {
    kpis:         ['D30/D60/D90 retention', 'Churn rate', 'DAU/MAU'],
    capabilities: ['Retention analysis', 'Behavioural cohorts', 'Alerts'],
    benchmarks: [
      'D30 retention improvement: +12–22%',
      'Churn reduction: 10–25%',
      'Repeat engagement rate: +15–30%',
    ],
  },
  Monetisation: {
    kpis:         ['ARPU', 'Upsell conversion', 'Basket size'],
    capabilities: ['Revenue analysis', 'Experiment', 'Predictive cohorts'],
    benchmarks: [
      'Upsell conversion uplift: +15–30%',
      'ARPU improvement: +10–20%',
      'Basket size / attach rate: +12–25%',
    ],
  },
  'Operational Efficiency': {
    kpis:         ['Time to insight', 'Experiment velocity', 'Data team load'],
    capabilities: ['Global Agent', 'Self-serve analytics', 'CDP'],
    benchmarks: [
      'Time to insight reduction: 50–70%',
      'Experiment velocity increase: 2–4×',
      'Data team load reduction: 30–60%',
    ],
  },
};

const VALID_STAGES = Object.keys(STAGE_MAP);
const STAGE_ALIASES = {
  'operational efficiency': 'Operational Efficiency',
  'ops efficiency': 'Operational Efficiency',
  'efficiency': 'Operational Efficiency',
};

// ── Public API ─────────────────────────────────────────────────────────────────

function inferSector(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Exact known-company match
  if (KNOWN_COMPANIES[key]) return KNOWN_COMPANIES[key];

  // 2. Partial known-company match
  for (const [company, sector] of Object.entries(KNOWN_COMPANIES)) {
    if (key.includes(company) || company.includes(key)) return sector;
  }

  // 3. Keyword scan
  const words = name.toLowerCase().split(/\W+/);
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => words.some(w => w.includes(kw) || kw.includes(w)))) {
      return sector;
    }
  }

  // 4. Regional default (rough heuristic)
  const apac = ['asia', 'apac', 'sg', 'my', 'id', 'ph', 'vn', 'th', 'au', 'nz'];
  if (apac.some(r => key.includes(r))) return 'fintech';

  return 'saas'; // Western default
}

function resolveStage(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  // Direct match
  const direct = VALID_STAGES.find(s => s.toLowerCase() === lower);
  if (direct) return direct;
  // Alias match
  if (STAGE_ALIASES[lower]) return STAGE_ALIASES[lower];
  // Partial match
  const partial = VALID_STAGES.find(s => lower.includes(s.toLowerCase()));
  if (partial) return partial;
  return null;
}

/**
 * Parse "story for [customer] [optional stage]" into { customer, stageRaw }
 */
function parseTrigger(text) {
  const patterns = [
    /(?:build|get me|create)\s+a\s+story\s+for\s+(.+)/i,
    /story\s+for\s+(.+)/i,
    /story\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;

    const rest = m[1].trim();
    // Detect trailing stage: separated by space, hyphen, slash, or comma
    const stagePattern = new RegExp(
      `[\\s\\-/,]+(?:${VALID_STAGES.map(s => s.replace(/ /g, '\\s+')).join('|')}|operational\\s+efficiency|ops\\s+efficiency|efficiency)$`,
      'i'
    );
    const stageMatch = rest.match(stagePattern);
    if (stageMatch) {
      const stageRaw = stageMatch[0].replace(/^[\s\-/,]+/, '').trim();
      const customer = rest.slice(0, rest.length - stageMatch[0].length).trim();
      return { customer, stageRaw };
    }

    return { customer: rest, stageRaw: null };
  }
  return null;
}

/**
 * Resolve everything needed for story generation from just a customer name (+ optional raw stage).
 */
function resolve(customerName, stageRaw = null) {
  const sector = inferSector(customerName);
  const stage  = resolveStage(stageRaw) || DEFAULT_STAGE[sector] || 'Retention';
  const map    = STAGE_MAP[stage];

  return {
    customer:     customerName,
    sector,
    stage,
    kpis:         map.kpis,
    capabilities: map.capabilities,
    benchmarks:   map.benchmarks,
  };
}

module.exports = { parseTrigger, resolve, inferSector, resolveStage, STAGE_MAP };
