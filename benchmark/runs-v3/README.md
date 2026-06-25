# AST-Bench V3 — captured run records (90 cells)

This directory holds the per-run evidence for the v3 live-database benchmark:
**3 shapes × 3 lanes × 2 agents × 5 repeats = 90 cells**, laid out as
`<shape>/<lane>/<agent>/repeat-<n>/`.

## What's published here (committed, auditable)

Each cell directory contains:

- **`run-manifest.json`** — the record of that run: model used, status
  (`passed`/`failed`), token counts (from the agent's own session logs),
  cost, elapsed time, `cheatSignals`, `liveDbWritten` (an agent-code-independent
  check that the writes actually landed in the live database),
  `changedFiles`, and `evidenceSha256` — a fingerprint chain over the run's
  prompt, transcript, diff, test log, and DB snapshots.
- **`prompt.md`** — the exact task given to the agent.
- **`diff.patch`** — the exact code the agent wrote (vs. the frozen start state).
- **`tests.log`** — the live-database acceptance test output.

`batch-progress.log` is the chronological run-by-run log of the whole batch.

## What's intentionally NOT committed (regenerable, bulky)

To keep the repo light, these are git-ignored:

- `**/workspace/` — the per-run agent workspace (contains a symlinked
  `node_modules`).
- `**/raw-transcript/` — the full agent session transcripts (large).
- `**/db-before/`, `**/db-after/` — the live-DB snapshots.

The `evidenceSha256` array in each `run-manifest.json` still fingerprints those
files, so their integrity is provable; the committed manifest + diff + test log
are enough to audit *what each run did and whether it passed honestly*. To
regenerate the full artifacts, re-run the cell:

```sh
npm run db:up   # live MongoDB :27018 + Postgres :5433
node scripts/benchmark-run-v3.mjs --shape <shallow|moderate|deep> \
  --lane <mongo|postgres-norm|postgres-jsonb> --agent <claude-code|codex> --repeat <n> --keep-ns
```

## Scoring

`scripts/benchmark-score-v3.mjs` reads only **clean** manifests
(`passed` + `liveDbWritten` + no cheat signals + only `src/workflow.mjs`
changed) and emits within-agent medians to `benchmark/results/summary-v3.json`.
81 of the 90 runs were clean; the 9 rejected runs remain here, visible, so the
exclusions can be audited too.
