#!/usr/bin/env node
// AST-Bench V3 public bundle — "shape wins, not the brand" framing, built from
// the scored summary-v3.json. Emits benchmark/public-bundle-v3.json + lab copy.

import { existsSync } from "node:fs";
import { readJson, source, writeJson } from "./benchmark-lib.mjs";

const SUMMARY = "benchmark/results/summary-v3.json";
const OUT = "benchmark/public-bundle-v3.json";
const LAB = "prototypes/lab-console/evidence/ast-bench-v3/benchmark-public-bundle.json";

if (!existsSync(SUMMARY)) throw new Error(`Missing ${SUMMARY}. Run: node scripts/benchmark-score-v3.mjs`);
const s = readJson(SUMMARY);

const LANE_LABEL = { "mongo": "MongoDB", "postgres-norm": "Postgres (normalized)", "postgres-jsonb": "Postgres (tuned JSONB)" };

// Cost projection assumptions — VISIBLE and adjustable on-page, kept separate
// from measured per-run deltas (the no-mock gate requires this separation).
const PROJECTION = {
  agentTasksPerMonth: 1000,
  note: "Illustrative scale-up of the measured per-task cost difference. Assumptions are shown so you can change them; the per-task numbers are measured, the monthly figure is arithmetic."
};

function agentBlock(a) {
  return {
    agentId: a.agentId,
    label: a.label,
    model: a.model,
    lanes: Object.fromEntries(Object.entries(a.lanes).map(([lane, v]) => [lane, {
      label: LANE_LABEL[lane],
      cleanRepeats: v.cleanRepeats,
      medianTokensRead: v.medianTokensRead,
      medianCostUsd: v.medianCostUsd,
      medianElapsedMs: v.medianElapsedMs
    }])),
    vsMongo: a.vsMongo,
    perShape: a.perShape,
    // per-agent monthly cost projection vs its own mongo baseline (within-agent only)
    projection: projectionFor(a)
  };
}

function projectionFor(a) {
  const mongo = a.lanes.mongo.medianCostUsd || 0;
  const out = { tasksPerMonth: PROJECTION.agentTasksPerMonth, mongoMonthlyUsd: round2(mongo * PROJECTION.agentTasksPerMonth) };
  for (const lane of ["postgres-norm", "postgres-jsonb"]) {
    const c = a.lanes[lane].medianCostUsd || 0;
    out[lane] = {
      monthlyUsd: round2(c * PROJECTION.agentTasksPerMonth),
      monthlyDeltaVsMongoUsd: round2((c - mongo) * PROJECTION.agentTasksPerMonth)
    };
  }
  return out;
}
function round2(x) { return Math.round(x * 100) / 100; }

const agents = s.agents.map(agentBlock);

// Data-driven headline sentence (shape-wins framing).
const normWorseBoth = s.findings.normalizedPostgresWorseOnBothAgents;
const jsonbSplit = s.findings.tunedJsonbSplitsAgents;

const bundle = {
  schemaVersion: "3.0.0",
  suiteId: "ast-bench-v3",
  status: "pilot",
  executionMode: "live-db",
  generatedAt: new Date().toISOString(),
  claimLabel: "3 database designs × 2 AI assistants × 5 repeats = 90 live-database runs",
  hero: {
    kicker: `2 AI coding assistants · same feature · real MongoDB + Postgres · ${s.integrity.clean} clean runs`,
    headline: "It's the data shape that saves AI work — not the database brand.",
    statement: normWorseBoth
      ? "Both AI assistants did more work on normalized, multi-table Postgres than on MongoDB. Reshaping Postgres into a single JSON-style document recovers much of the difference — but that means hand-building the document model and giving up the relational structure Postgres is chosen for, and it didn't help both assistants equally."
      : "See the per-assistant results below.",
    agentsAgree: normWorseBoth
  },
  primer: {
    whatChanged: "Every run here is a real AI coding session against a real database — live MongoDB and live Postgres, not files. The AI must work out the answer from raw business facts (we removed any pre-filled answers), and it has to save its results back into the live database for the test to pass.",
    threeLanes: "We tested three database designs for the same feature: MongoDB (one document), normalized Postgres (the textbook many-table design), and tuned Postgres (one table with a JSON column shaped like the document). The third is the design a seasoned Postgres engineer would reach for — the fair fight."
  },
  agents,
  laneOrder: ["mongo", "postgres-norm", "postgres-jsonb"],
  laneLabels: LANE_LABEL,
  projectionAssumptions: PROJECTION,
  methodology: {
    shapeWins: "The pattern that holds across both assistants: the normalized, multi-table Postgres design costs the AI the most work. The closer the database is to a single document shaped around how the feature reads it, the less the AI has to do. MongoDB gives that shape by default; Postgres can match it with a hand-built JSON design.",
    liveDb: "Every run is a real coding session against a real database — live MongoDB and live Postgres in Docker. The AI connects, reads the raw facts, derives the answer, and writes results back; the test then reads the live database to check. An automated check confirms the writes actually landed in the database, so a run can't pass by faking it with a local file.",
    deLeaked: "The data contains only raw business facts — no pre-filled status, owners, or risk flags. The AI must derive the answer from the rules. Control cases with deliberately different correct answers confirm an assistant can't pass by copying.",
    withinAgentOnly: "Within-agent comparison only: we compare each assistant to itself across the three designs. We never put one assistant's numbers next to the other's — the two tools count their internal work in different units, so only each one's own design-to-design difference is meaningful.",
    cheaperModels: "Both assistants ran on small, low-cost models (not the flagship tier). The cheaper models still built correct, working code against real databases — more evidence you don't need the most expensive AI to build well.",
    honestSplit: jsonbSplit
      ? "Honest result: tuned JSON-style Postgres split the two assistants. One still did clearly more work than on MongoDB; the other did slightly less. We report it exactly as measured — the document shape helps, but how much depends on the assistant."
      : "Tuned JSON-style Postgres closed much of the gap for both assistants.",
    limits: `This is a focused pilot on one feature with cheap models: ${s.integrity.clean} clean runs out of ${s.integrity.total} attempted (${s.integrity.failed} were rejected by the integrity checks and excluded). Per-design depth trends are not a perfectly straight line — real measurement is noisy, and we show it as-is.`,
    pathToOfficial: "To become officially-endorsed material this still needs an independent Postgres-fairness review and a formal sign-off. The tuned-JSON design strengthens the fairness story but does not replace outside review."
  },
  integrity: s.integrity,
  evidenceClaims: [
    {
      id: "live-db",
      question: "Are the runs really against live databases?",
      verdict: "Yes. Each run connects to a real MongoDB or Postgres database, reads raw facts, and writes results back. An automated check reads the live database afterward and rejects any run whose results didn't actually land there.",
      sources: [
        source("scripts/benchmark-livedb.mjs"),
        source("scripts/benchmark-run-v3.mjs")
      ]
    },
    {
      id: "de-leak",
      question: "Could the AI pass by copying the answer?",
      verdict: "No. The data holds only raw facts; the answer is derived from rules. Control cases with different correct answers are rejected if an assistant just copies a status — proven before any scored run.",
      sources: [
        source("scripts/benchmark-derive.mjs"),
        source("scripts/benchmark-prove-v3.mjs")
      ]
    },
    {
      id: "fair-postgres",
      question: "Did Postgres get a fair design?",
      verdict: "Yes. Besides the textbook normalized design, we added a tuned single-table JSON design with an index — what a seasoned Postgres engineer would actually build. Results are reported for both.",
      sources: [
        source("scripts/benchmark-livedb.mjs"),
        source("docs/superpowers/specs/2026-06-24-live-db-3lane-benchmark-design.md")
      ]
    },
    {
      id: "real-runs",
      question: "Where do the numbers come from?",
      verdict: `From real captured run records — token counts from each tool's own session logs, fingerprinted so they can't be altered. ${s.integrity.clean} clean runs scored; ${s.integrity.failed} rejected by integrity checks and excluded.`,
      sources: [
        source("benchmark/results/summary-v3.json"),
        source("benchmark/evidence-v3/mongo-shallow-codex-r1-manifest.json"),
        source("benchmark/evidence-v3/postgres-norm-shallow-codex-r1-manifest.json"),
        source("benchmark/evidence-v3/postgres-jsonb-shallow-codex-r1-manifest.json")
      ]
    },
    {
      id: "within-agent",
      question: "Is this comparing databases, not AIs?",
      verdict: "Yes. Each assistant is compared only to itself across the three database designs. One assistant's numbers are never stacked against the other's, because the two tools count work in different units.",
      sources: [
        source("scripts/benchmark-score-v3.mjs")
      ]
    },
    {
      id: "anti-cheat",
      question: "Can a run cheat the test?",
      verdict: "The assistant may only edit the workflow file. Editing the database helper or the test, or adding a file-based shortcut, is auto-detected and fails the run. A separate check confirms results landed in the live database.",
      sources: [
        source("scripts/benchmark-run-v3.mjs")
      ]
    }
  ],
  caveats: [
    s.caveat,
    "Tuned JSON-style Postgres split the two assistants: clearly worse than MongoDB for one, slightly better for the other. Shown, not hidden.",
    `Integrity: ${s.integrity.clean}/${s.integrity.total} runs clean; ${s.integrity.failed} rejected (${Object.entries(s.integrity.reasons).map(([k, v]) => `${v} ${k}`).join(", ")}).`,
    "One cell (shallow normalized Postgres, Claude) has only 2 clean repeats — the cheap model repeatedly tripped the integrity guard on that lane.",
    "Per-design depth trend is not perfectly monotonic; reported as measured.",
    "Focused pilot, cheap models, one feature. Not yet officially-endorsed material."
  ]
};

writeJson(OUT, bundle);
writeJson(LAB, bundle);
console.log(`AST-Bench v3 bundle emitted: ${OUT} (clean ${s.integrity.clean}/${s.integrity.total})`);
