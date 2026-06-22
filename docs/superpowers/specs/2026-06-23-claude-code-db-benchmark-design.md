# AST-Bench: Claude Code MongoDB-vs-Postgres Benchmark + Ship-Ready Console

Date: 2026-06-23
Status: Approved design, pre-plan

## One-sentence thesis

We benchmark **databases, not models.** Same task, same acceptance test, same coding
agent — only the database shape changes (MongoDB document model vs Postgres normalized
relational). We measure how much work the agent had to do. Claude Code and Codex are two
**independent measuring instruments**; running both shows the database conclusion does not
depend on which agent you picked.

## Problem with today's state (ground truth, verified 2026-06-23)

- The only real captured evidence is **Codex** (3 lane runs). The **Claude Code adapter is
  broken**: `benchmark-run.mjs` invokes `claude -p --output-format stream-json` without the
  required `--verbose` flag, so the pilot errored in 3s with `0` files changed. Claude Code
  has therefore **never actually run** in this benchmark.
- Tokens are currently **estimated** as `transcriptBytes / 4` (`benchmark-lib.mjs:168`).
  The user explicitly cares about token efficiency, so estimates are not good enough.
- Verified facts that make this feasible:
  - Bedrock SSO (`ai-prod-llm`) is live; `claude` 2.1.186 and `codex` 0.130.0 installed.
  - Docker MongoDB (`:27018`) and Postgres (`:5433`) are healthy.
  - The **real Codex transcript already carries true tokens**: `input_tokens`,
    `output_tokens`, `cached_input_tokens`.
  - **Claude Code with `--verbose` emits real `usage` + `total_cost_usd` per run.**

## What we measure (all real, per run, no estimates for the headline)

| Metric | Source | Customer meaning |
|---|---|---|
| Input / output tokens | real CLI `usage` event | "how much the AI had to read and write" |
| Cost (USD) | Claude `total_cost_usd`; Codex = tokens × published price | money |
| Elapsed wall time | harness clock | "wait less" |
| Retries / failed commands | transcript events | "struggle less" |
| Files changed / diff bytes | `git diff` | change footprint (shown even when Mongo loses it) |
| Pass / fail | acceptance test | did the feature actually ship |

Byte-estimated tokens may remain as a **fallback only**, clearly labeled, used solely if a
CLI fails to emit usage. The headline always uses real tokens.

## Benchmark matrix

- **5 tasks, one per domain:**
  - `strategic-account-rescue` (Customer 360 / CRM)
  - `split-shipment-exception` (Order & Commerce Ops)
  - `sla-breach-route` (Support / SLA)
  - `invoice-dispute-workflow` (Billing / Revenue Ops)
  - `data-access-audit-export` (Compliance / Audit Ops)
- **2 DB lanes:** mongo, postgres
- **3 repeats** per cell (gives within-cell variance — the honesty knob)
- **2 agents:** claude-code, codex (true head-to-head on the identical task set)
- **Total: 5 × 2 × 3 × 2 = 60 real runs.**

Runs execute in the background. A single calibration run is taken first to get a true
per-run wall time before committing the full batch. Real DBs throughout. Synthetic
**fixtures** are allowed; synthetic **results** are never allowed.

## Fairness contract (the honest core)

- The **only** valid comparison is the **within-agent delta**: Claude(mongo) vs
  Claude(postgres), and Codex(mongo) vs Codex(postgres).
- Cross-agent absolute numbers (e.g. "Claude used fewer tokens than Codex") are
  apples-to-oranges and are **never displayed or claimed**. This is a database benchmark.
- Headline claim shape: *"Two independent agents, same five tasks — both needed more
  tokens, more time, and more retries on Postgres."* Reported as **median across 3
  repeats**, with the spread (min–max or IQR) visible.
- Mixed metrics stay visible. If MongoDB loses a metric in a cell (e.g. larger diff), it is
  shown, not hidden.
- Any cell that fails acceptance is shown as failed and excluded from the won/lost delta,
  never silently dropped.

## Components / work breakdown

1. **Harness — real token extraction.** New helper that parses each agent's transcript for
   true `usage` (Claude `result.usage` + `total_cost_usd`; Codex `input/output/cached`).
   Wire into `benchmark-run.mjs` manifest `metrics`. Keep `bytes/4` only as labeled
   fallback. Unit-tested against the captured Codex transcript and the Claude probe shape.
2. **Harness — fix Claude Code adapter.** Add `--verbose`; capture `total_cost_usd`;
   confirm `parseCommandStats` counts Claude tool_use events correctly.
3. **Calibration run.** One real Claude `strategic-account-rescue/mongo` run end-to-end;
   confirm it passes acceptance and emits real tokens; record wall time.
4. **Batch runner.** Drive the 60 runs in background with per-cell logging and resumability
   (skip cells whose manifest already exists). Never wedge on a single failed cell.
5. **Scoring.** Extend `benchmark-score.mjs` to compute within-agent medians + spread per
   metric per agent, and an agent-agreement summary. Update `summary.json` /
   `public-bundle.json`. Gates must still block overclaim and `public-v1`.
6. **Console rework.** Rework the existing single-file console (`prototypes/lab-console/
   index.html`) — keep the data-contract and fail-closed discipline; rebuild first-viewport
   hierarchy so a non-technical viewer answers in ~10s: *what was tested, which DB won, by
   how much, can I see proof.* One headline number, agent-agreement badge, a two-bar
   comparison, one obvious "Inspect evidence" path. Remove internal/seller-only language.
7. **Verification.** `npm run build`, `proof:no-mock`, `benchmark:gates`,
   `benchmark:ui:test` all green. Browser smoke of the console (real browser, not just
   build) per the user's standing UI rule. Copy audited against overclaim guardrails.

## What we will NOT claim

- Not "world V1" (that needs the full 450-run, 3-agent, 25-task matrix).
- Not "guaranteed savings."
- Not a model-vs-model contest.
- Honest public label: **"Focused benchmark — 5 domains, 2 agents, real runs,"** with the
  exact run count and any failed cells visible.

## Acceptance criteria for the whole effort

- 60 real runs captured (or fewer, with every missing/failed cell explicitly shown — never
  hidden), each with real token + cost + time + retry + diff + pass/fail evidence.
- Console first viewport answers the four questions for a non-technical viewer; every metric
  on screen is backed by an inspectable artifact.
- No cross-agent model claim anywhere. Within-agent deltas only.
- All gates green; console verified in a real browser; no overclaim copy.

## Risks

- **Per-run time / total runtime** — mitigated by calibration run before full batch.
- **A task that no agent can pass on one lane** — shown as failed, excluded from deltas,
  surfaced honestly; does not block the build.
- **Bedrock throttling / SSO expiry mid-batch** — batch runner is resumable; re-run skips
  completed cells.
- **Token-field shape drift between CLI versions** — extraction is defensive and falls back
  to labeled estimate rather than crashing or fabricating.
