// Build-Bench P1 public bundle — greenfield-CRUD results.
// Generated from benchmark/runs-buildbench/summary.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const summary = JSON.parse(readFileSync("benchmark/runs-buildbench/summary.json", "utf8"));

const LANE_LABELS = {
  "mongo": "MongoDB",
  "postgres-norm": "Postgres (normalized)",
  "postgres-jsonb": "Postgres (JSONB)",
};

const bundle = {
  schemaVersion: "1.0.0",
  suiteId: "build-bench",
  taskType: "greenfield-crud",
  status: "complete",
  executionMode: "live-db",
  generatedAt: new Date().toISOString(),
  claimLabel: "Build-Bench P1: greenfield-CRUD × 3 lanes × 2 agents × 5 repeats = 30 live-DB runs",
  hero: {
    headline: "Build-Bench: which database is easier for AI to <em>build</em> on?",
    statement: "We asked AI coding agents to design a database schema from scratch and implement CRUD against a live database. The result surprised us — and refuted our own hypothesis.",
    badge: "30 live-DB runs · EEO-tuned · 5/5 clean",
  },
  primer: [
    { tag: "The task", text: "Design the schema for an <b>accounts</b> resource and implement CRUD (create, read, update, delete) against a live database. The database starts <b>empty</b> — the agent designs everything from scratch." },
    { tag: "The lanes", text: "Three database designs: <b>MongoDB</b> (document), <b>Postgres normalized</b> (columns + CHECK constraints), <b>Postgres JSONB</b> (JSONB doc + GIN index)." },
    { tag: "The measure", text: "How many tokens the AI agent had to <b>read</b> (input + cached) to make it work — verified against the live database, not just passing tests." },
    { tag: "The honesty", text: "We pre-registered two hypotheses. <b>Both were refuted.</b> Postgres normalized won. We're publishing the result anyway." },
  ],
  agents: summary.agents.map((a) => ({
    agentId: a.agentId,
    lanes: a.lanes,
    vsMongo: a.vsMongo,
  })),
  laneOrder: ["mongo", "postgres-norm", "postgres-jsonb"],
  laneLabels: LANE_LABELS,
  hypotheses: summary.hypotheses,
  fairness: {
    eeoApplied: true,
    eeoNote: "Postgres lanes designed by an Equal-Effort Opponent subagent (fresh context, blind to MongoDB design). Postgres designs include named CHECK constraints, status index, jsonb_path_ops GIN index, and key-match constraints — more complex than the original author-designed references.",
    redTeamLog: "benchmark/red-team/p1/red-team-log.md",
    contractProof: "6/6 passed (stub fails, reference passes, per lane)",
  },
  caveats: [
    "Within-agent comparison only — never compare absolute token counts across Claude Code and Codex (they count tokens incompatibly).",
    "This is a build-time benchmark (making it run and work), not a production-performance benchmark.",
    "Only 1 of 4 planned task types (greenfield-CRUD). Migration, query, and relationship task types are future work.",
    "The MongoDB lane was designed by the benchmark authors (who have a MongoDB interest). The result refutes the MongoDB thesis — an author-biased result going against the author's interest is credible evidence, but full EEO (external MongoDB expert) remains a future improvement.",
    "H1 and H2 were pre-registered before any agent runs. Both are refuted by the data. Refuted hypotheses are reported as refuted.",
  ],
  caveat: summary.caveat,
};

const out = join("prototypes", "lab-console", "evidence", "build-bench-p1", "benchmark-buildbench-p1.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(bundle, null, 2) + "\n");
console.log(`Build-Bench P1 bundle written to ${out}`);
