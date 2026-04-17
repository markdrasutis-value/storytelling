'use strict';

/**
 * Formats three story arcs into Slack Block Kit and WhatsApp plain text.
 * Follows the exact layout specified in the Story Intelligence skill.
 */

const DIVIDER_HEAVY = '━━━━━━━━━━━━━━━━━━━━━━━━';
const DIVIDER_LIGHT = '─────────────────────────';

// ── Slack Block Kit ───────────────────────────────────────────────────────────

function toSlackBlocks(stories, { customer, sector, stage, webUrl }) {
  const sectorLabel = sector.charAt(0).toUpperCase() + sector.slice(1);

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${DIVIDER_HEAVY}\n:book: *3 Stories for ${customer}*\n_Sector: ${sectorLabel} · Stage: ${stage}_\n${DIVIDER_HEAVY}`,
      },
    },
    { type: 'divider' },
  ];

  stories.forEach((story, i) => {
    const outcomes = story.outcomes.map(o => `• ${o}`).join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Story ${i + 1} · ${story.angle}*`,
          `*Situation:* ${story.situation}`,
          `*Complication:* ${story.complication}`,
          `*Resolution:* ${story.resolution}`,
          `*Result:*\n${outcomes}`,
          `*Why ${customer}:* ${story.signal}`,
        ].join('\n'),
      },
    });

    if (i < stories.length - 1) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: DIVIDER_LIGHT },
      });
    }
  });

  blocks.push({ type: 'divider' });

  // Action buttons
  const actions = {
    type: 'actions',
    elements: [],
  };

  if (webUrl) {
    actions.elements.push({
      type: 'button',
      text: { type: 'plain_text', text: '🎨 View Storyboards', emoji: true },
      url: webUrl,
      style: 'primary',
    });
  }

  actions.elements.push({
    type: 'button',
    text: { type: 'plain_text', text: '🔄 Regenerate', emoji: true },
    value: `regenerate:${customer}`,
    action_id: 'regenerate_story',
  });

  blocks.push(actions);

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `_Story Intelligence · Amplitude GTM_`,
      },
    ],
  });

  return blocks;
}

/** The text that appears on the Slack notification (Block Kit fallback). */
function toSlackFallback(customer) {
  return `3 Story Arcs for ${customer} — Story Intelligence`;
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

function toWhatsApp(stories, { customer, sector, stage }) {
  const sectorLabel = sector.charAt(0).toUpperCase() + sector.slice(1);
  const lines = [
    `📖 *3 Stories for ${customer}*`,
    `_Sector: ${sectorLabel} · Stage: ${stage}_`,
    '',
  ];

  stories.forEach((story, i) => {
    lines.push(`*Story ${i + 1} · ${story.angle}*`);
    lines.push(`*Situation:* ${story.situation}`);
    lines.push(`*Complication:* ${story.complication}`);
    lines.push(`*Resolution:* ${story.resolution}`);
    lines.push(`*Result:*`);
    story.outcomes.forEach(o => lines.push(`• ${o}`));
    lines.push(`*Why ${customer}:* ${story.signal}`);
    if (i < stories.length - 1) lines.push('');
  });

  lines.push('');
  lines.push('_Story Intelligence · Amplitude GTM_');

  return lines.join('\n');
}

// ── Plain text (clipboard / preview) ─────────────────────────────────────────

function toPlainText(stories, { customer, sector, stage }) {
  const sectorLabel = sector.charAt(0).toUpperCase() + sector.slice(1);
  const lines = [
    `${DIVIDER_HEAVY}`,
    `3 Stories for ${customer}`,
    `Sector: ${sectorLabel} · Stage: ${stage}`,
    `${DIVIDER_HEAVY}`,
    '',
  ];

  stories.forEach((story, i) => {
    lines.push(`Story ${i + 1} · ${story.angle}`);
    lines.push(`Situation: ${story.situation}`);
    lines.push(`Complication: ${story.complication}`);
    lines.push(`Resolution: ${story.resolution}`);
    lines.push('Result:');
    story.outcomes.forEach(o => lines.push(`  • ${o}`));
    lines.push(`Why ${customer}: ${story.signal}`);
    if (i < stories.length - 1) { lines.push(''); lines.push(DIVIDER_LIGHT); lines.push(''); }
  });

  lines.push('');
  lines.push(`${DIVIDER_HEAVY}`);
  lines.push('Story Intelligence · Amplitude GTM');

  return lines.join('\n');
}

module.exports = { toSlackBlocks, toSlackFallback, toWhatsApp, toPlainText };
