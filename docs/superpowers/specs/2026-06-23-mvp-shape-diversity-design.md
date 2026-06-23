# AST-Bench v2 (MVP): Shape-Diversity Proof + Marketing-Grade Results Page

Date: 2026-06-23
Status: Approved design, pre-plan
Predecessor: `docs/superpowers/specs/2026-06-23-claude-code-db-benchmark-design.md` (v1, shipped to main @ c433eeb)

## One-sentence thesis

The v1 benchmark proved the *direction* (MongoDB makes coding agents do less database work)
but on **one schema shape worn five ways**. The MVP closes that hole by varying the single
causal variable — how much state the agent must reconstruct from the database — across three
genuinely different relational depths, then presents the result as a marketing-grade,
leadership-ready page instead of an internal proof console.

## Why this is the minimum viable proof (and why 450 is not required)

A benchmark's job is to be **falsifiable and reproducible, not exhaustive.** v1 already
killed the two hardest objections: "only your favorite agent" (two agents agree) and "the
numbers are fake" (real, hash-verified, reproducible). 450 runs = 25 tasks × 2 lanes × 3
agents × 3 repeats — but if the 25 tasks are the same shape relabeled (v1's are; verified:
`buildTaskFixture` ignores task identity beyond owner-group labels), then ~390 of those runs
buy decimal places on a conclusion 60 runs already reached. The remaining real objections are:

- "You tested one schema shape five times." ← **the actual hole; this MVP fixes it.**
- "n=3, the losing cells are noise." ← addressed by raising repeats to 5.
- "You rigged Postgres." ← addressed by an idiomatic-normalization requirement + inspectable
  traces; full closure is an independent fairness review (listed as the step to *official*).

The MVP spends the **same ~60-run budget** on the axes that close objections, not on
repetition.

## v1 ground truth this builds on (verified 2026-06-23)

- The hardened harness is intact and reusable: real-token extractor (`scripts/agent-usage.mjs`,
  tokensRead = input + cached), cheat detection (`detectCheatSignals` in `benchmark-run.mjs`),
  frozen-commit diff capture, within-agent scorer (`computeDatabaseVerdict` in
  `benchmark-score.mjs`), hash-verifying no-mock gate (`check-no-mock-data.mjs` re-hashes every
  evidence source), deterministic build (`score && bundle`).
- The shape hole is structural: `benchmark-lib.mjs:buildTaskFixture` always calls one
  `buildMongoFixture`/`buildPostgresFixture` template; `benchmark-prepare.mjs:workflowStub` is
  lane-based and identical across tasks. **This is what the MVP changes.**
- v1 result (60 runs, within-agent): Codex +15% tokens-read / +15% cost / +18% time / +33
  retries on Postgres; Claude Code +4% / +9% / +8% / +16. Both favor MongoDB on all 4 metrics.
- v1 per-task analysis: MongoDB cheaper on tokens-read in 8/10 task-agent cells; the 2 losses
  were in the shallowest tasks — consistent with the hypothesis that the effect grows with
  relational depth, which the MVP tests directly.

## The benchmark design (the proof)

- **3 shapes, one shared business outcome, one shared acceptance contract per outcome:**
  - **Shallow** — 1 document ≈ a few tables (the v1 shape).
  - **Moderate** — some 1-to-many normalization (contacts, owner groups, risk signals as rows).
  - **Deep** — heavy idiomatic 3NF: many tables, foreign keys, at least one junction (M:N)
    table; the agent must reconstruct product state across 10+ joins before it can act.
- **Same customer-visible outcome across all 3 shapes.** Only the underlying schema depth
  differs. Any metric difference is therefore attributable to shape alone — the cleanest
  possible "same everything, just the database" control.
- **The asymmetry is the finding.** MongoDB's document model stays effectively flat as the
  relational model normalizes deeper; Postgres imposes progressively more
  schema-reconstruction work. Both lanes' deltas are shown openly (including any metric where
  MongoDB does not win), and the trace proves the agent really did the extra join/schema work.
- **Hard fairness requirement:** every Postgres schema must be idiomatic best-practice
  (textbook normalization with sensible keys/indexes), NOT a contrived strawman. The deep
  shape is "what a competent DBA would build," not "the worst SQL imaginable." Independent
  human fairness review remains the documented step to *official* status (out of MVP scope).
- **Matrix: 3 shapes × 2 lanes (mongo, postgres) × 2 agents (claude-code, codex) × 5 repeats
  = 60 real runs.** Same budget as v1, aimed at the causal variable. Repeats raised from 3 to 5
  because v1 within-cell variance was high (Codex per-task ranged −21% to +109%).

## The "why" panel (auto-extracted trace highlights)

A pure, unit-tested extractor parses the **real captured transcripts** per run and surfaces a
plain-language contrast per shape, e.g. *"Postgres lane: agent inspected 8 tables, wrote 5
JOINs, hit 2 FK errors. MongoDB lane: agent read 1 document."* Counts are derived from the raw
transcript (table/JOIN/FK mentions, command counts), never hand-written. The deep shape should
show the starkest contrast — that is the visual punchline. Reproducible, low fabrication risk;
consistent with the "real evidence only" ethos. If a transcript yields no parseable signal, the
panel shows "trace highlight unavailable" rather than inventing one (fail honest).

## The UI (marketing-grade results page)

Audience shifts from internal/seller review to **leadership / sales / buyers**. The page is a
results/marketing page, not a forensic console. Forensic rigor moves one click down, not away.

- **Full copy wipe of internal jargon.** Remove customer-facing "Agent Schema Tax," "Proof
  mode," "case-study gate," the "450" bar, "seed replay," and evidence-drawer scaffolding from
  the primary view. None of our internal methodology debate belongs on the customer surface.
- **Hero (agreement-first, least-attackable):** "Two independent AI coding agents. Same app,
  same tasks. Both did measurably less work on MongoDB."
- **Layout = twin-agent cards, each owns a graph (chosen option 2):** Codex and Claude Code as
  twin cards, EACH with its own animated mini bar-graph across the 4 metrics (tokens read,
  cost, time, retries), MongoDB vs Postgres, "lower = better," Postgres always taller. The two
  same-shaped graphs ARE the visual proof of agreement. Bars animate up on load
  (`prefers-reduced-motion` respected).
- **Below the fold:** the 3-shape story (punchline: the gap widens as Postgres normalizes —
  shown as the three shapes side by side), the auto-extracted why-panel, then methodology +
  inspectable evidence for skeptics ("Inspect the evidence" → the hardened proof layer).
- **Honest labeling:** the "5 domains" claim is removed (it was the one real overclaim — the v1
  shapes were identical). The label reflects what was actually run: e.g. "3 schema shapes × 2
  agents × 5 repeats = 60 real runs." The 450-run full-V1 bar may appear ONLY in the
  methodology/limitations section, never the hero.
- **Principle:** impressive through clarity + real numbers + motion, never through hype or
  hidden caveats. We animate the real result because the real result is genuinely good.

## Architecture, reuse, and components

- **Reuse unchanged:** `agent-usage.mjs`, `benchmark-run.mjs` (cheat detection + frozen diff),
  `benchmark-run-batch.mjs`, `benchmark-score.mjs` (`computeDatabaseVerdict`),
  `check-no-mock-data.mjs` (hash verification), the deterministic `build`.
- **Primary change — shape-parameterized generation:** `benchmark-lib.mjs` gains shape-aware
  fixture builders (shallow/moderate/deep for each lane) keyed off a new `shape` field on the
  task/suite; `benchmark-prepare.mjs` writes shape-appropriate schema docs, migrations, and the
  shared acceptance contract. One acceptance contract per outcome, reused across shapes, so the
  control holds. The before-state must still fail by assertion (not ReferenceError) in every
  shape — the v1 fail-closed property is preserved per shape.
- **New — trace-highlight extractor:** a pure module (sibling to `agent-usage.mjs`) with unit
  tests, consumed by the bundle builder so the why-panel reads from the bundle.
- **New/reworked — marketing page:** either a reworked `prototypes/lab-console/index.html` or a
  fresh page over the same `public-bundle.json` data contract. The UI gate
  (`benchmark-ui-test.mjs`) is currently coupled to v1's IDs/functions/copy; the MVP updates the
  gate deliberately and in lockstep with the page (gate and page change in the same commit),
  keeping the fail-closed and no-overclaim assertions.
- **Spec/suite:** a new suite spec (e.g. `benchmark/specs/ast-bench-v2.json` or an extension)
  defining the 3 shapes, shared outcome, 2 agents, 5 repeats. Do not silently mutate v1's
  spec/results; v2 is additive so v1 evidence remains intact and inspectable.

## Testing & verification

- Per shape: before-state acceptance FAILS by assertion; a real solution PASSES. Idiomatic
  Postgres schema confirmed by inspection.
- All 60 runs integrity-swept: 0 cheats, real diffs (non-empty, frozen-commit based), tokens
  measured, no test/data edits.
- Full gate suite green: `build`, `benchmark:validate`, `benchmark:gates`,
  `benchmark:test-gates`, `benchmark:ui:test`, `proof:no-mock`, plus all unit tests
  (`test-agent-usage`, `test-database-verdict`, the new trace-highlight test).
- Evidence hashes self-consistent (committed bundle hash matches committed files; gate catches
  tamper).
- Marketing page verified in a REAL browser (headless Chrome render + screenshot review), not
  just by gate pass — per the standing "UI changes need browser smoke" rule.
- Calibration run before the full batch to confirm the deep shape is solvable by both agents
  and to re-confirm per-run timing.

## What we will NOT claim

- Not public V1 (still 450 runs across 25 tasks × 3 agents × 3 repeats for that). The MVP is a
  focused shape-diversity proof.
- Not "guaranteed savings." Not a model-vs-model contest (within-agent only, enforced in code).
- Not "officially endorsed MongoDB material" — that requires the independent fairness review
  and MongoDB brand/legal sign-off, both documented as out-of-scope next steps.

## Acceptance criteria for the whole effort

- 3 genuinely different schema shapes (shallow/moderate/deep), same outcome, idiomatic Postgres.
- 60 real runs captured (or fewer, with every missing/failed cell shown honestly), 5 repeats.
- Within-agent verdict per shape; the page shows whether the MongoDB advantage GROWS with
  relational depth (the core MVP hypothesis), honestly whichever way it lands.
- Auto-extracted why-panel backed by real traces.
- Marketing-grade page: agreement-first hero, twin-agent graphs, internal jargon gone, honest
  scope label, evidence one click down. Verified in a real browser.
- All gates + unit tests green; evidence hashes self-consistent; within-agent-only preserved.

## Risks

- **Deep shape unsolvable by an agent** → calibration run first; if a cell genuinely can't pass,
  show it as failed/exempt honestly, never loosen the test.
- **"You rigged Postgres"** → idiomatic-normalization requirement + inspectable traces; full
  closure via independent review (out of scope, documented).
- **Effect does NOT grow with depth (or reverses)** → that is a real finding; report it
  honestly. The benchmark's value is being falsifiable. Do not bury a null/negative result.
- **UI gate coupling** → update gate and page in lockstep; never weaken the no-overclaim /
  fail-closed assertions to make a redesign pass.
- **Token incomparability across CLIs** (v1 lesson) → keep tokensRead = input + cached; never
  compare token absolutes across agents.
