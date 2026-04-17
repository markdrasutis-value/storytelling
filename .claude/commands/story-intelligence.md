---
name: story-intelligence
description: >
  ALWAYS trigger when the user types "story for [customer]" or any close variant
  ("build a story for", "get me a story for", "create a story for", "story [customer]").
  The customer name is the ONLY required input. An optional growth stage may trail
  the customer name (e.g. "story for Officeworks retention"). Never ask for sector,
  KPIs, tone, or any other information. Resolve everything automatically and deliver
  THREE distinct story arcs via the appropriate surface -- Slack DM when in Slack
  context, interactive artifact otherwise. Trigger immediately with no clarifying
  questions.
---

# Story Intelligence Agent

## Purpose

Generate three sector-matched, anonymised Amplitude customer story arcs from a
single input: the customer name plus an optional growth stage. Everything else is
resolved automatically. Deliver all three stories as a single formatted Slack
message (primary path) or interactive artifact (fallback/preview).

---

## Trigger

Any of these phrases (case-insensitive):
- `story for [customer]`
- `story for [customer] [stage]`
- `build a story for [customer]`
- `get me a story for [customer]`
- `create a story for [customer]`
- `story [customer]`

Extract `[customer]` and optional `[stage]`. Begin resolution immediately.

### Stage parsing

The stage trails the customer name, separated by a space, hyphen, slash, or comma.
Accept any reasonable variant:

| Input variant                        | Parsed stage   |
|--------------------------------------|----------------|
| `story for Officeworks retention`    | Retention      |
| `story for Grab - acquisition`       | Acquisition    |
| `story for DBS / monetisation`       | Monetisation   |
| `story for Canva, activation`        | Activation     |
| `story for Kmart`                    | (infer)        |

Valid stages: `Acquisition` · `Activation` · `Retention` · `Monetisation` · `Operational Efficiency`

If no stage is provided, infer the most commercially relevant stage from the sector
using the default mapping in Step 3 below. Never ask.

---

## Delivery Path Decision

Check context before generating:

| Context                              | Delivery format              |
|--------------------------------------|------------------------------|
| Triggered via Slack (bot/webhook)    | Slack Block Kit message      |
| Triggered in Claude.ai conversation  | Interactive HTML artifact    |
| Triggered via WhatsApp               | Plain text with emoji format |

In Claude.ai, always render the artifact. Also output a collapsed
Slack-ready version below the artifact so the AE can copy/paste
into Slack immediately.

---

## Resolution Logic

### Step 1 -- Infer sector

Use training knowledge to infer sector from the company name. Priority order:

1. Known company → infer directly (Grab = superapp, DBS = fintech, Kmart = ecommerce)
2. Unknown name + regional context → apply most probable sector for that market
3. Truly ambiguous → default to `fintech` for SEA/APAC, `saas` for Western names

Never ask. Always infer and proceed.

Sector labels:
`fintech` · `ecommerce` · `superapp` · `saas` · `media` · `travel` · `telco` · `health`

---

### Step 2 -- Resolve stage

If stage was provided in the trigger, use it directly.

If no stage was provided, infer from sector using this default map:

| Sector              | Default stage            | Reasoning                              |
|---------------------|--------------------------|----------------------------------------|
| ecommerce / travel  | Acquisition              | Conversion and funnel is the core pain |
| fintech             | Retention                | Transaction frequency and D30 are key  |
| superapp            | Activation               | Cross-service activation drives LTV    |
| saas                | Activation               | Trial-to-paid is the primary lever     |
| media               | Retention                | Subscriber churn is the existential risk|
| telco               | Monetisation             | Upsell and ARPU expansion              |
| health              | Retention                | Habit formation and D60 are critical   |

---

### Step 3 -- Map stage + sector to KPIs and Amplitude capabilities

Each story must connect the stage to specific Amplitude product capabilities.

| Stage                  | KPIs                                          | Amplitude capabilities to reference              |
|------------------------|-----------------------------------------------|--------------------------------------------------|
| Acquisition            | Funnel conversion, drop-off rate, CAC         | Funnel analysis, cohort comparison, pathfinder   |
| Activation             | Time to first value, feature adoption, onboarding completion | Guides & Surveys, session replay, user journeys |
| Retention              | D30/D60/D90 retention, churn rate, DAU/MAU    | Retention analysis, behavioural cohorts, alerts  |
| Monetisation           | ARPU, upsell conversion, basket size          | Revenue analysis, experiment, predictive cohorts |
| Operational Efficiency | Time to insight, experiment velocity, data team load | Global Agent, self-serve analytics, CDP     |

---

### Step 4 -- Select tone per story

Generate three stories, each with a distinct angle and tone:

| Story | Angle             | Tone                                              |
|-------|-------------------|---------------------------------------------------|
| 1     | The insight story  | Proof-led -- a specific signal that changed decisions |
| 2     | The speed story    | Outcome-led -- how fast they moved from question to action |
| 3     | The scale story    | Challenger -- what they couldn't do before that they can now |

Each story uses the same SITUATION but diverges at COMPLICATION.
All three must feel meaningfully different -- not the same story reworded.

---

### Step 5 -- Build each story arc

Five-part structure. Every element must be fully anonymised.

```
SITUATION    Context this customer type operates in.
             Set the scene -- scale, stage, competitive pressure.
             (Shared across all three stories -- set once, vary from here.)

COMPLICATION What was breaking before Amplitude.
             Specific to each story's angle. Make the cost feel real.

RESOLUTION   What Amplitude specifically enabled.
             Name the specific feature or capability.

RESULT       Verified indicative outcomes with ranges.
             Cite signal source type.

SIGNAL       Why this fits the named customer specifically.
             One sentence. Must name the customer.
```

---

### Step 6 -- Indicative outcome benchmarks

Use these ranges in RESULT blocks. Always ranges, never single numbers.

| Stage                  | Outcome                            | Indicative range       |
|------------------------|------------------------------------|------------------------|
| Acquisition            | Funnel conversion uplift           | +18 -- 30%             |
| Acquisition            | Funnel drop-off reduction          | 20 -- 40%              |
| Activation             | Time to first value improvement    | 30 -- 50% faster       |
| Activation             | Feature adoption uplift            | +25 -- 45%             |
| Activation             | Onboarding completion rate         | +20 -- 35%             |
| Retention              | D30 retention improvement          | +12 -- 22%             |
| Retention              | Churn reduction                    | 10 -- 25%              |
| Retention              | Repeat engagement rate             | +15 -- 30%             |
| Monetisation           | Upsell conversion uplift           | +15 -- 30%             |
| Monetisation           | ARPU improvement                   | +10 -- 20%             |
| Monetisation           | Basket size / attach rate          | +12 -- 25%             |
| Operational Efficiency | Time to insight reduction          | 50 -- 70%              |
| Operational Efficiency | Experiment velocity increase       | 2 -- 4x                |
| Operational Efficiency | Data team request load reduction   | 30 -- 60%              |

---

## Slack Delivery Format

Three stories delivered as a single DM. Each story is a self-contained block.
Entire message must be scannable in under 60 seconds on a phone.

```
━━━━━━━━━━━━━━━━━━━━━━━━
📖 *3 Stories for [CUSTOMER]*
_Sector: [SECTOR] · Stage: [STAGE]_
━━━━━━━━━━━━━━━━━━━━━━━━

*Story 1 · The Insight*
*Situation:* [1 sentence]
*Complication:* [1--2 sentences]
*Resolution:* [1 sentence naming the Amplitude capability]
*Result:* [2--3 outcome ranges]
*Why [CUSTOMER]:* [1 sentence]

─────────────────────────

*Story 2 · The Speed*
...

*Story 3 · The Scale*
...

━━━━━━━━━━━━━━━━━━━━━━━━
_Story Intelligence · Amplitude GTM_
```

Each story section: under 80 words. Three stories total: under 300 words.

---

## Quality Rules

- No jargon: no "leverage", "synergy", "unlock value", "empower"
- No hedging: no "might", "could potentially", "may help"
- Every stat must map to a benchmark range in the table above
- Signal block must name the customer -- never generic
- Tone: confident, specific, human
