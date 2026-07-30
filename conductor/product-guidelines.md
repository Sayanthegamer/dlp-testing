# Product Guidelines & UX Principles

## Visual Aesthetics & Tone

**Exam-native, not app-native.** The whole point is that this should feel
like handling an actual exam paper, not like using AI software. Every
visual decision should be checked against: "would this look at home on
a printed exam paper, or does it look like a generic SaaS dashboard?"

### Palette
- Background: warm paper white `#FAF7F0` (not stark white, not the
  overused cream/beige AI-app default — slightly warmer and less yellow
  than typical "paper" tints)
- Primary text / ink: `#232323` (soft black, like real ink on paper —
  never pure `#000000`)
- Borders / rules: `#DCD5C4` (like the faint grid/rule lines on ruled
  exam paper)
- Review flag accent: `#B8622E` (a muted burnt-orange/amber — used ONLY
  for the review banner and flagged-block border, nowhere else)
- Correct-answer badge: `#3F6B4A` (a muted, desaturated green — like a
  teacher's actual red-pen-adjacent correction color, not a bright
  "success green" UI color)
- Never introduce a second bright/saturated accent color beyond these two
  — one warning tone, one confirmation tone, nothing else competing for
  attention.

### Typography
- Question text & math: a serif built for long-form reading — Source
  Serif 4 or Lora, not Georgia (Georgia is the default "looks like Word"
  choice, which undercuts the "exam paper" feeling rather than
  reinforcing it)
- UI chrome (buttons, labels, toolbar, nav): a plain grotesk — Inter or
  IBM Plex Sans — kept visually quiet so it never competes with the
  question content, which is the actual product
- Question numbers ("Q1", "Q2"): set in the serif, slightly larger,
  sitting to the left of the block like a real paper's numbering — not
  a UI badge/chip/pill shape

### Layout
- Each question block reads like an actual numbered exam question on
  paper: number at left, question text and math flowing naturally, MCQ
  options as lettered choices (A/B/C/D) rather than checkboxes or radio
  buttons styled like generic form inputs
- Blocks are separated by generous whitespace and a thin rule line —
  not cards with drop shadows. Drop-shadowed "cards" read as generic
  SaaS; a paper page doesn't have shadows between its questions.

## Interaction Principles
- **No separate edit mode.** Editing happens directly in the rendered
  block — click text to edit text, click a formula to open its floating
  math toolbar. There is never a toggle between "preview" and "edit."
- **No modal-heavy flows.** Uploads, review flags, and math editing all
  happen inline or as small floating popovers anchored to what they're
  editing — never a full-screen modal that disconnects the teacher from
  the rest of the question list.
- **Calm, not flashy.** No onboarding tours, no confetti, no "AI is
  thinking..." animations with sparkle icons. A quiet, plain loading
  state (a simple pulse or fade) is enough — this tool's trustworthiness
  comes from feeling boring and reliable, like a good photocopier, not
  from feeling impressive.
- **Zero LaTeX exposure, absolute rule.** Not "minimized" — zero. No
  backslash, no `\frac`, no raw math syntax should ever be visible or
  editable by a teacher, under any circumstance, in any screen, including
  error states. If a math span fails to render, the error state shown to
  the teacher describes it in plain language ("this formula needs a
  check") — never a KaTeX parse error message.