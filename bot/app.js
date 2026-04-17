'use strict';

/**
 * Amplitude Story Intelligence — Slack Bot
 *
 * Trigger: "story for [customer]" (+ optional stage) in any channel.
 *
 * Flow:
 *   1. Bot acks Slack immediately (ephemeral "Generating…" reply to requester)
 *   2. Resolves sector + stage from customer name only
 *   3. Calls Claude API to generate 3 story arcs + SVG fields
 *   4. DMs the requester with Block Kit stories + "View Storyboards" link
 *   5. Posts a thread reply in the original channel: "Story ready — check your DMs"
 *
 * Lambda note: context.callbackWaitsForEmptyEventLoop = false lets the function
 * keep running after returning the HTTP 200 to Slack / API Gateway.
 * Set Lambda timeout to 29s in serverless.yml.
 *
 * WhatsApp path: POST /whatsapp/webhook from Twilio.
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { App, AwsLambdaReceiver } = require('@slack/bolt');
const { parseTrigger, resolve }  = require('./intelligence');
const { generateStories }        = require('./story-engine');
const { toSlackBlocks, toSlackFallback, toWhatsApp } = require('./formatter');

// Load verified outcomes from #customer-verified-outcomes (Slack) or sample file
async function loadVerifiedOutcomes(sector) {
  try {
    const file = path.join(__dirname, '..', 'data', 'sample_outcomes.json');
    const all  = JSON.parse(fs.readFileSync(file, 'utf8'));
    const relevant = all.filter(f => !sector || f.sector === sector || f.sector === 'general');
    return relevant.length ? relevant : all.slice(0, 4);
  } catch (_) {
    return [];
  }
}

const WEB_BASE_URL = process.env.WEB_BASE_URL || ''; // e.g. https://org.github.io/storytelling

// ── Slack App ──────────────────────────────────────────────────────────────────

const receiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token:               process.env.SLACK_BOT_TOKEN,
  receiver,
  processBeforeResponse: false, // ack fast, process after
});

// ── Trigger listener ───────────────────────────────────────────────────────────

const TRIGGER_RE = /(?:(?:build|get me|create)\s+a\s+story\s+for|story\s+for|story)\s+.+/i;

app.message(TRIGGER_RE, async ({ message, client, say }) => {
  const text   = message.text || '';
  const parsed = parseTrigger(text);
  if (!parsed) return;

  const { customer, stageRaw } = parsed;
  const userId  = message.user;
  const channel = message.channel;
  const threadTs = message.ts;

  // 1. Immediate ephemeral ack to the requester
  try {
    await client.chat.postEphemeral({
      channel,
      user:   userId,
      text:   `:hourglass_flowing_sand: Generating 3 stories for *${customer}*…`,
      thread_ts: threadTs,
    });
  } catch (_) { /* non-fatal */ }

  try {
    // 2. Resolve everything from name alone
    const context = resolve(customer, stageRaw);

    // 3. Load verified outcomes (sector-filtered, with source_customer for AE citation)
    const verifiedOutcomes = await loadVerifiedOutcomes(context.sector);

    // 4. Generate 3 story arcs via Claude
    const stories = await generateStories({ ...context, verifiedOutcomes });

    // 4. Build web artifact URL (encodes story data in hash for GitHub Pages)
    let webUrl = null;
    if (WEB_BASE_URL) {
      const payload = Buffer.from(JSON.stringify({ ...context, stories })).toString('base64url');
      webUrl = `${WEB_BASE_URL}/artifact.html#${payload}`;
    }

    // 5. DM the requester
    const blocks = toSlackBlocks(stories, {
      customer:  context.customer,
      sector:    context.sector,
      stage:     context.stage,
      webUrl,
    });

    await client.chat.postMessage({
      channel: userId, // DM
      blocks,
      text: toSlackFallback(customer),
    });

    // 6. Thread reply in origin channel
    await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `:white_check_mark: 3 story arcs for *${customer}* ready — check your DMs.`,
    });

  } catch (err) {
    console.error('Story generation error:', err);
    try {
      await client.chat.postEphemeral({
        channel,
        user:   userId,
        text:   `:warning: Something went wrong generating stories for *${customer}*: ${err.message}`,
        thread_ts: threadTs,
      });
    } catch (_) { /* ignore */ }
  }
});

// ── Regenerate button handler ──────────────────────────────────────────────────

app.action('regenerate_story', async ({ body, ack, client }) => {
  await ack();
  const customerName = (body.actions[0]?.value || '').replace('regenerate:', '');
  if (!customerName) return;

  const userId  = body.user.id;
  const channel = body.channel?.id || userId;

  try {
    await client.chat.postEphemeral({
      channel,
      user: userId,
      text: `:hourglass_flowing_sand: Regenerating stories for *${customerName}*…`,
    });

    const context = resolve(customerName);
    const verifiedOutcomes = await loadVerifiedOutcomes(context.sector);
    const stories = await generateStories({ ...context, verifiedOutcomes });
    let webUrl = null;
    if (WEB_BASE_URL) {
      const payload = Buffer.from(JSON.stringify({ ...context, stories })).toString('base64url');
      webUrl = `${WEB_BASE_URL}/artifact.html#${payload}`;
    }
    const blocks = toSlackBlocks(stories, { ...context, webUrl });

    await client.chat.postMessage({
      channel: userId,
      blocks,
      text: toSlackFallback(customerName),
    });
  } catch (err) {
    console.error('Regenerate error:', err);
  }
});

// ── WhatsApp webhook (Twilio) ──────────────────────────────────────────────────

// Handled outside Bolt via the raw Lambda handler below.

// ── Lambda handler ─────────────────────────────────────────────────────────────

let _handler;

module.exports.handler = async (event, context, callback) => {
  // Don't freeze Lambda after API Gateway returns — let async processing complete.
  context.callbackWaitsForEmptyEventLoop = false;

  // WhatsApp path
  if (event.path === '/whatsapp/webhook' && event.httpMethod === 'POST') {
    return handleWhatsApp(event);
  }

  // Slack path
  if (!_handler) _handler = await receiver.start();
  return _handler(event, context, callback);
};

async function handleWhatsApp(event) {
  const params = new URLSearchParams(event.body || '');
  const body   = (params.get('Body') || '').trim();

  let reply;

  if (/^(?:hi|hello|help|\?)$/i.test(body)) {
    reply =
      '📖 *Amplitude Story Engine*\n\n' +
      'Send: `story for [customer name]`\n\n' +
      'Example: `story for Grab`\n\n' +
      'Optionally add a stage: `story for Grab retention`';
  } else {
    const parsed = parseTrigger(body);
    if (!parsed) {
      reply = 'Send `story for [customer name]` to generate stories. Send `help` for more.';
    } else {
      try {
        const context = resolve(parsed.customer, parsed.stageRaw);
        const verifiedOutcomes = await loadVerifiedOutcomes(context.sector);
        const stories = await generateStories({ ...context, verifiedOutcomes });
        reply = toWhatsApp(stories, context);
      } catch (err) {
        reply = `Sorry, something went wrong: ${err.message}`;
      }
    }
  }

  // TwiML response
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Message></Response>`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml' },
    body: twiml,
  };
}
