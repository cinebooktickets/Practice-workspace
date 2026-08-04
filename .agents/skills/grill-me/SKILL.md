---
name: grill-me
description: Adversarial alignment protocol. Use when the PO starts a new project from scratch, describes a product they want to build, asks to plan a new feature, or says things like "let's add X", "I want to build Y". Goes deep with structured options + free-text override per question. Two modes: vision (whole product) and feature (single deliverable).
---

# Grill me

A skipped question becomes a rebuild later. The grill ends only when every
required angle has either an explicit answer or an explicit `deferred to <id>`.

## Two grill modes

| Mode | When | Angles | Approx |
|---|---|---|---|
| **Vision grill** | the user describes a new product or project from scratch | idea · target user · first feature · constraints | 5–10 min |
| **Feature grill** | the user asks to add or change a feature ("let's add X") | behavior · acceptance criteria · edge cases · out-of-scope · UX shape · data shape | 10–15 min |

Tech-stack questions live inside the feature grill (when a new service is
implied), not as a separate mode.

## When NOT to grill

The grill is for vague or incomplete requests — not for re-confirming clear
ones. If the request already contains concrete acceptance criteria (expected
inputs/outputs, fields, behaviors): record the stated criteria as Decisions,
then ask at most 1–2 targeted questions about genuine gaps, or state your
assumption and proceed. When no one is available to answer (headless or
automated runs), state assumptions explicitly and continue — never stall.

## Question shape

Every grill question follows this exact shape so novices can pick and experts
can override:

```
Q: <one-sentence question>

  [a] <option>      — <one-line rationale>
  [b] <option>      — <…>
  [c] <option>      — <…>
  [d] <option>      — <…>

  Or describe your own: ___
```

Rules:
- 3–5 options, mutually exclusive.
- One option flagged `[recommended]` — the sensible default.
- Free-text override always available.
- Questions arrive in batches of 3–5 per turn. No 25-question walls.

## What "harsh" means

- The grill runs **at least one follow-up pass** asking "given those answers,
  what about X edge?"
- Non-answers ("figure it out later") become `deferred to <auto-id>` and are
  recorded as such — never silently filled in.
- Contradictions across answers are surfaced explicitly: "earlier you said
  [a]; this answer implies [b]; which is right?"
- The grill refuses to write the output document until **every required angle
  has a concrete answer or a recorded deferral.**

## Required angles

### Vision grill
- One-sentence product statement
- Single first user (specific, not "everyone")
- The single first feature to ship
- Three things this product is **not** (out-of-scope)
- Hard constraints (budget, timeline, regulatory, must-be-mobile)

### Feature grill
- Single-sentence feature statement
- Triggering action (who does what, when)
- Observable outcome (what success looks like)
- 3–5 acceptance criteria — each independently testable
- 2–3 edge cases the PO already imagines
- Out-of-scope list
- UX shape (page · component · API endpoint · background job · CLI · webhook)
- Data shape (entities, new or existing)
- API style (if applicable)
- UI/UX feel (if applicable)

## Output discipline

The output document MUST contain a `## Decisions` section recording every grill
answer verbatim. Without it, the document is a draft, not a deliverable.

## After the grill: test-driven development

Record the Decisions, turn each acceptance criterion into a **failing test
first**, then implement until green. Never write implementation code for a
feature whose grill hasn't finished.
