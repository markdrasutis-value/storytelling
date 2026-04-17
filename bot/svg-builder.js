'use strict';

/**
 * SVG Storyboard Builder
 *
 * Produces an 680×600 SVG storyboard per story arc following the
 * template structure: header / three panels (Problem · Solution · Outcome) / footer.
 */

// ── Colour themes per angle ───────────────────────────────────────────────────
const THEMES = {
  'The Insight': { accent: '#d4a843', badge: '#3b2800' },
  'The Speed':   { accent: '#d4a843', badge: '#3b2800' },
  'The Scale':   { accent: '#6C8EFF', badge: '#1a2060' },
};

// ── Text helpers ──────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap a string into lines of ≤maxChars each, returning up to maxLines lines. */
function wrap(text, maxChars, maxLines = 3) {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      if (lines.length >= maxLines) break;
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

/** Render an array of short strings as SVG text lines starting at (cx, startY). */
function textLines(lines, cx, startY, fontSize, fill, dy = 18, anchor = 'middle', bold = false) {
  return lines.map((ln, i) =>
    `<text x="${cx}" y="${startY + i * dy}" text-anchor="${anchor}" font-size="${fontSize}" ${bold ? 'font-weight="bold"' : ''} fill="${fill}">${esc(ln)}</text>`
  ).join('\n');
}

// ── Build one SVG storyboard ─────────────────────────────────────────────────
function buildSVG({ story, customer, sector, stage, storyNum }) {
  const { angle, situation, svg } = story;
  const theme = THEMES[angle] || THEMES['The Insight'];

  // Ensure svg fields exist with safe defaults
  const headline       = esc(svg?.headline       || '');
  const headlineUnit   = esc(svg?.headline_unit   || '');
  const problemLines   = (svg?.problem_lines       || ['Data was fragmented', 'No single view', 'Teams worked blind']).slice(0, 3);
  const probConseq     = (svg?.problem_consequence || ['Decisions delayed.', 'Revenue at risk.']).slice(0, 3);
  const capability     = esc(svg?.capability       || 'Amplitude');
  const capabilitySub  = esc(svg?.capability_sub   || '');
  const solutionLines  = (svg?.solution_lines      || ['Self-serve insight.', 'No analyst queue.', 'Teams move fast.']).slice(0, 3);
  const solutionBen    = (svg?.solution_benefit    || ['Speed to market.', 'Better decisions.']).slice(0, 3);
  const outcomeHead    = esc(svg?.outcome_headline || '');
  const outcomeUnit    = esc(svg?.outcome_unit     || '');

  // Wrap situation text (header band is wide)
  const situationLines = wrap(situation, 82, 2);

  return `<svg width="680" height="600" viewBox="0 0 680 600" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">

  <defs>
    <marker id="arr${storyNum}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#555577" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <!-- HEADER -->
  <rect x="0" y="0" width="680" height="${situationLines.length > 1 ? 86 : 76}" fill="#1a1a2e"/>
  <rect x="0" y="0" width="680" height="4" fill="${theme.accent}"/>
  <rect x="24" y="12" width="6" height="20" rx="2" fill="${theme.accent}"/>
  <text x="38" y="26" font-size="14" font-weight="bold" fill="#ffffff">Story ${storyNum} · ${esc(angle)}</text>
  <rect x="554" y="10" width="102" height="22" rx="4" fill="${theme.badge}"/>
  <text x="605" y="25" text-anchor="middle" font-size="11" font-weight="bold" fill="#E1F5EE">${esc(stage)} stage</text>
  <rect x="24" y="38" width="632" height="${situationLines.length > 1 ? 40 : 28}" rx="4" fill="#26264a"/>
  ${situationLines.map((l, i) =>
    `<text x="36" y="${55 + i * 16}" font-size="12" fill="#ccccee">${esc(l)}</text>`
  ).join('\n  ')}

  <!-- PANEL LABELS -->
  <rect x="24" y="${situationLines.length > 1 ? 96 : 84}" width="194" height="28" rx="6" fill="#633806"/>
  <text x="121" y="${situationLines.length > 1 ? 114 : 102}" text-anchor="middle" font-size="13" font-weight="bold" fill="#ffffff">Problem</text>
  <rect x="243" y="${situationLines.length > 1 ? 96 : 84}" width="194" height="28" rx="6" fill="#185FA5"/>
  <text x="340" y="${situationLines.length > 1 ? 114 : 102}" text-anchor="middle" font-size="13" font-weight="bold" fill="#ffffff">Solution</text>
  <rect x="462" y="${situationLines.length > 1 ? 96 : 84}" width="194" height="28" rx="6" fill="#27500A"/>
  <text x="559" y="${situationLines.length > 1 ? 114 : 102}" text-anchor="middle" font-size="13" font-weight="bold" fill="#ffffff">Outcome</text>

  <!-- ── PANEL 1 — PROBLEM ─────────────────────────────────────────── -->
  <rect x="24" y="${situationLines.length > 1 ? 130 : 118}" width="194" height="316" rx="8" fill="#1a0d00" stroke="#854F0B" stroke-width="1.5"/>
  <circle cx="121" cy="${situationLines.length > 1 ? 178 : 166}" r="34" fill="#633806"/>
  <text x="121" y="${situationLines.length > 1 ? 170 : 158}" text-anchor="middle" font-size="22" font-weight="bold" fill="#ffffff">${headline}</text>
  <text x="121" y="${situationLines.length > 1 ? 190 : 178}" text-anchor="middle" font-size="10" fill="#FAC775">${headlineUnit}</text>
  <line x1="44" y1="${situationLines.length > 1 ? 226 : 214}" x2="198" y2="${situationLines.length > 1 ? 226 : 214}" stroke="#854F0B" stroke-width="0.5"/>
  ${textLines(problemLines, 121, situationLines.length > 1 ? 250 : 238, 12, '#ffffff', 18, 'middle', true)}
  ${textLines(probConseq, 121, situationLines.length > 1 ? 318 : 306, 12, '#FAC775', 16, 'middle', false)}
  <line x1="44" y1="${situationLines.length > 1 ? 362 : 350}" x2="198" y2="${situationLines.length > 1 ? 362 : 350}" stroke="#854F0B" stroke-width="0.5"/>
  <text x="121" y="${situationLines.length > 1 ? 432 : 420}" text-anchor="middle" font-size="10" fill="#412402">Data / analytics gap</text>

  <!-- ── PANEL 2 — SOLUTION ────────────────────────────────────────── -->
  <rect x="243" y="${situationLines.length > 1 ? 130 : 118}" width="194" height="316" rx="8" fill="#011020" stroke="#185FA5" stroke-width="1.5"/>
  <circle cx="340" cy="${situationLines.length > 1 ? 178 : 166}" r="34" fill="#185FA5"/>
  <text x="340" y="${situationLines.length > 1 ? 172 : 160}" text-anchor="middle" font-size="11" font-weight="bold" fill="#ffffff">${capability}</text>
  <text x="340" y="${situationLines.length > 1 ? 189 : 177}" text-anchor="middle" font-size="10" fill="#B5D4F4">${capabilitySub}</text>
  <line x1="263" y1="${situationLines.length > 1 ? 226 : 214}" x2="417" y2="${situationLines.length > 1 ? 226 : 214}" stroke="#185FA5" stroke-width="0.5"/>
  ${textLines(solutionLines, 340, situationLines.length > 1 ? 250 : 238, 12, '#ffffff', 18, 'middle', true)}
  ${textLines(solutionBen, 340, situationLines.length > 1 ? 318 : 306, 12, '#B5D4F4', 16, 'middle', false)}
  <line x1="263" y1="${situationLines.length > 1 ? 362 : 350}" x2="417" y2="${situationLines.length > 1 ? 362 : 350}" stroke="#185FA5" stroke-width="0.5"/>
  <text x="340" y="${situationLines.length > 1 ? 432 : 420}" text-anchor="middle" font-size="10" fill="#0C447C">Amplitude platform</text>

  <!-- ── PANEL 3 — OUTCOME ─────────────────────────────────────────── -->
  <rect x="462" y="${situationLines.length > 1 ? 130 : 118}" width="194" height="316" rx="8" fill="#060f03" stroke="#27500A" stroke-width="1.5"/>
  <circle cx="559" cy="${situationLines.length > 1 ? 178 : 166}" r="34" fill="#27500A"/>
  <text x="559" y="${situationLines.length > 1 ? 170 : 158}" text-anchor="middle" font-size="22" font-weight="bold" fill="#ffffff">${outcomeHead}</text>
  <text x="559" y="${situationLines.length > 1 ? 190 : 178}" text-anchor="middle" font-size="10" fill="#C0DD97">${outcomeUnit}</text>
  <line x1="482" y1="${situationLines.length > 1 ? 226 : 214}" x2="636" y2="${situationLines.length > 1 ? 226 : 214}" stroke="#27500A" stroke-width="0.5"/>
  <rect x="482" y="${situationLines.length > 1 ? 234 : 222}" width="154" height="44" rx="6" fill="#122809"/>
  <text x="559" y="${situationLines.length > 1 ? 251 : 239}" text-anchor="middle" font-size="11" fill="#C0DD97">Benchmark 1</text>
  <text x="559" y="${situationLines.length > 1 ? 271 : 259}" text-anchor="middle" font-size="20" font-weight="bold" fill="#ffffff">${esc(story.outcomes[0] || '')}</text>
  <rect x="482" y="${situationLines.length > 1 ? 286 : 274}" width="154" height="44" rx="6" fill="#122809"/>
  <text x="559" y="${situationLines.length > 1 ? 303 : 291}" text-anchor="middle" font-size="11" fill="#C0DD97">Benchmark 2</text>
  <text x="559" y="${situationLines.length > 1 ? 323 : 311}" text-anchor="middle" font-size="20" font-weight="bold" fill="#ffffff">${esc(story.outcomes[1] || '')}</text>
  <rect x="482" y="${situationLines.length > 1 ? 338 : 326}" width="154" height="44" rx="6" fill="#122809"/>
  <text x="559" y="${situationLines.length > 1 ? 355 : 343}" text-anchor="middle" font-size="11" fill="#C0DD97">Benchmark 3</text>
  <text x="559" y="${situationLines.length > 1 ? 375 : 363}" text-anchor="middle" font-size="20" font-weight="bold" fill="#ffffff">${esc(story.outcomes[2] || story.outcomes[1] || '')}</text>

  <!-- ARROWS -->
  <line x1="222" y1="${situationLines.length > 1 ? 290 : 278}" x2="239" y2="${situationLines.length > 1 ? 290 : 278}" stroke="#555577" stroke-width="1.5" marker-end="url(#arr${storyNum})"/>
  <line x1="441" y1="${situationLines.length > 1 ? 290 : 278}" x2="458" y2="${situationLines.length > 1 ? 290 : 278}" stroke="#555577" stroke-width="1.5" marker-end="url(#arr${storyNum})"/>

  <!-- FOOTER -->
  <rect x="0" y="${situationLines.length > 1 ? 460 : 448}" width="680" height="4" fill="${theme.accent}"/>
  <rect x="0" y="${situationLines.length > 1 ? 464 : 452}" width="680" height="136" fill="#12122a"/>
  <text x="36" y="${situationLines.length > 1 ? 484 : 472}" font-size="11" font-weight="bold" fill="${theme.accent}">Why ${esc(customer)}</text>
  ${wrap(story.signal, 88, 3).map((l, i) =>
    `<text x="36" y="${(situationLines.length > 1 ? 500 : 488) + i * 16}" font-size="11" fill="#aaaacc">${esc(l)}</text>`
  ).join('\n  ')}

</svg>`;
}

module.exports = { buildSVG };
