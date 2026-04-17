'use strict';

const fs   = require('fs');
const path = require('path');
const { resolve }        = require('./intelligence');
const { generateStories } = require('./story-engine');

const DIVIDER = '━'.repeat(56);
const THIN    = '─'.repeat(56);

async function run() {
  const customer  = process.argv[2] || 'Officeworks';
  const stageArg  = process.argv[3] || null;

  console.log(`\n${DIVIDER}`);
  console.log(`  Story Intelligence — terminal test`);
  console.log(`  Input: "${customer}"${stageArg ? ` + stage "${stageArg}"` : ''}`);
  console.log(DIVIDER);

  // 1. Resolve sector + stage from name alone
  const context = resolve(customer, stageArg);
  console.log(`\n  Sector : ${context.sector}`);
  console.log(`  Stage  : ${context.stage}`);
  console.log(`  KPIs   : ${context.kpis.join(', ')}`);
  console.log(`  Via    : ${context.capabilities.join(', ')}\n`);
  console.log(THIN);

  // 2. Load verified outcomes (sector-filtered, with source_customer)
  const sampleFile = path.join(__dirname, '..', 'data', 'sample_outcomes.json');
  const all  = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const verifiedOutcomes = all.filter(f => f.sector === context.sector || f.sector === 'general');
  console.log(`  Verified outcomes loaded: ${verifiedOutcomes.length} (sector: ${context.sector})\n`);

  // 3. Generate 3 story arcs via Claude
  console.log('  Calling Claude API...\n');
  const stories = await generateStories({ ...context, verifiedOutcomes });

  // 4. Print each arc
  stories.forEach((s, i) => {
    console.log(`\n${'━'.repeat(56)}`);
    console.log(`  Story ${i + 1} · ${s.angle}`);
    console.log('━'.repeat(56));
    console.log(`\n  SITUATION\n  ${s.situation}`);
    console.log(`\n  COMPLICATION\n  ${s.complication}`);
    console.log(`\n  RESOLUTION\n  ${s.resolution}`);
    console.log(`\n  OUTCOMES`);
    s.outcomes.forEach(o => console.log(`    • ${o}`));
    console.log(`\n  WHY ${customer.toUpperCase()}\n  ${s.signal}`);
  });

  console.log(`\n${DIVIDER}\n`);
}

run().catch(err => {
  console.error('\n  ✗ Error:', err.message);
  process.exit(1);
});
