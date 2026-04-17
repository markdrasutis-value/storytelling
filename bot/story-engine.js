'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let _client = null;
const client = () => _client || (_client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const SYSTEM = `You are an Amplitude GTM story generator. You produce three distinct, anonymised customer story arcs.

The three arcs share one SITUATION but each diverges with a different angle:
- Story 1 "The Insight"  — proof-led: a specific signal that changed a decision
- Story 2 "The Speed"    — outcome-led: how fast they moved from question to action
- Story 3 "The Scale"    — challenger: what they couldn't do before that they can now

Tone: confident, direct, zero jargon. No "leverage", "synergy", "unlock", "empower".
No hedging: no "might", "could potentially", "may".

Return ONLY a JSON array of exactly 3 objects. No markdown fences. No extra keys.

Each object:
{
  "angle": "The Insight" | "The Speed" | "The Scale",
  "situation": "1 tight sentence — the world this type of company operates in",
  "complication": "1–2 sentences — what was broken, specific to this angle's lens",
  "resolution": "1 sentence — what Amplitude specifically enabled, naming the capability",
  "outcomes": ["2–3 strings from the provided benchmark ranges"],
  "signal": "1 sentence naming the customer by name — why this story fits them specifically",
  "svg": {
    "headline": "Short metric or number for the problem circle (e.g. '5d', '40%', '3 wks')",
    "headline_unit": "Short unit label (e.g. 'per campaign read', 'drop-off rate')",
    "problem_lines": ["3 short punchy phrases (max 5 words each) describing the problem"],
    "problem_consequence": ["2–3 short phrases describing the cost of the problem"],
    "capability": "Amplitude capability name for the solution circle (e.g. 'Retention Analysis')",
    "capability_sub": "Short subtitle for capability (e.g. 'behavioural cohorts')",
    "solution_lines": ["3 short action phrases describing what changed (max 6 words each)"],
    "solution_benefit": ["2–3 short phrases describing what the team gained"],
    "outcome_headline": "A striking short metric for the outcome circle (e.g. '40s', '+22%')",
    "outcome_unit": "Short label for the headline metric (e.g. 'to first insight')"
  }
}`;

async function generateStories({ customer, sector, stage, kpis, capabilities, benchmarks, verifiedOutcomes = [] }) {
  // Build a cited evidence block so the AE can trace each claim back to a real customer
  const evidenceLines = verifiedOutcomes.map(f => {
    const cite = f.source_customer ? ` [verified: ${f.source_customer}]` : '';
    const ctx  = (f.context || '').slice(0, 200);
    return `  -${cite} ${ctx} → ${(f.outcomes || []).join(', ')}`;
  }).join('\n');

  const evidenceBlock = evidenceLines
    ? `Verified outcomes from similar customers (source in brackets — AE can confirm directly):\n${evidenceLines}\n\nWhere a [verified: Name] tag appears above, include it in the story text immediately after the anonymised persona descriptor. Example: "A leading e-commerce company [Kmart Australia] achieved..." This is intentional — the bracket tag lets the AE verify the outcome is real.`
    : `No verified outcomes on file yet — use the benchmark ranges only.`;

  const prompt = `Customer: ${customer}
Sector: ${sector}
Stage: ${stage}
KPIs: ${kpis.join(', ')}
Amplitude capabilities to reference: ${capabilities.join(', ')}
Outcome benchmarks (use these ranges verbatim in "outcomes"):
${benchmarks.map(b => `  - ${b}`).join('\n')}

${evidenceBlock}

Generate the JSON array now.`;

  const response = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2400,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();

  // Strip any accidental markdown fences
  const jsonStr = raw.startsWith('[') ? raw : (raw.match(/\[[\s\S]+\]/) || ['[]'])[0];
  const stories = JSON.parse(jsonStr);

  if (!Array.isArray(stories) || stories.length !== 3) {
    throw new Error(`Expected 3 story objects, got: ${stories.length}`);
  }

  return stories;
}

module.exports = { generateStories };
