#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import {
  formatMoneyShort,
  publicBundlePath,
  readJson,
  readSuite,
  resultPath,
  seedEvidenceBundlePath,
  seedReplayPath,
  seedRunSummaryPath,
  source,
  suitePath,
  writeJson
} from "./benchmark-lib.mjs";

const labBundlePath = "prototypes/lab-console/evidence/ast-bench-v1/benchmark-public-bundle.json";

if (!existsSync(resultPath)) {
  throw new Error(`Missing benchmark result summary. Run npm run benchmark:score first: ${resultPath}`);
}

const suite = readSuite();
const result = readJson(resultPath);
const seed = existsSync(seedRunSummaryPath) ? readJson(seedRunSummaryPath) : null;
const seedReplay = existsSync(seedReplayPath) ? readJson(seedReplayPath) : null;
const seedBundle = existsSync(seedEvidenceBundlePath) ? readJson(seedEvidenceBundlePath) : null;
const tokenDelta = seed?.deltas?.estimatedTranscriptTokenDelta || 0;
const elapsedSeconds = seed ? Math.round(seed.deltas.elapsedMsDelta / 1000) : 0;
const retryDelta = seed?.deltas?.retrySignalDelta || 0;
const diffDelta = seed?.deltas?.diffBytesDelta || 0;
const mongoLane = seed?.lanes?.mongo || {};
const postgresLane = seed?.lanes?.postgres || {};
const mongoTrace = parseTrace(mongoLane.artifacts?.rawTranscript, "mongo");
const postgresTrace = parseTrace(postgresLane.artifacts?.rawTranscript, "postgres");

const bundle = {
  schemaVersion: "1.0.0",
  suiteId: suite.suiteId,
  status: result.status,
  generatedAt: new Date().toISOString(),
  headline: "AST-Bench shows how much database work an AI coding agent pays before the same feature ships.",
  subhead: "Same task. Same Codex run contract. Same acceptance test. MongoDB kept the business state closer to the workflow, so the agent spent less context, less time, and fewer cleanup loops on this verified replay.",
  proofQuestion: "When the same agent builds the same workflow, how much work is product logic and how much is database-state reconstruction?",
  plainEnglish: {
    headline: "The feature shipped in both lanes. MongoDB made the AI read less, wait less, and clean up less.",
    seedAnswer: "In this verified replay, Codex passed both lanes. Postgres required more context, more elapsed time, and more cleanup signals. MongoDB had the larger code diff, so the page shows that mixed metric instead of hiding it.",
    audiencePromise: "A CEO sees the business cost. A developer can open the raw trace, diff, tests, database proof, and hashes."
  },
  architectureQuestion: "Is the real comparison one database versus one database, or one MongoDB data plane versus a stitched stack?",
  stackComparison: [
    {
      id: "mongodb-data-plane",
      label: "MongoDB",
      plainLabel: "One data plane",
      summary: "Operational data, document shape, full-text search, vector search, and hybrid retrieval can stay close to the application workflow.",
      proofStatus: "Measured here for the operational workflow lane.",
      evidenceId: "database-proof",
      pieces: ["app data", "document model", "text search", "vector search", "audit trail"]
    },
    {
      id: "stitched-postgres-stack",
      label: "Postgres + Elastic + Pinecone",
      plainLabel: "Three-system stack",
      summary: "A common enterprise stack may split relational state, search, vectors, sync jobs, permissions, and audit proof across multiple systems.",
      proofStatus: "Not measured by this replay; use as the next benchmark question.",
      evidenceId: "benchmark-contract",
      pieces: ["relational data", "search index", "vector index", "sync jobs", "cross-system audit"]
    }
  ],
  progress: {
    label: result.status,
    requiredLaneRuns: result.requiredLaneRuns,
    capturedLaneRuns: result.capturedLaneRuns,
    passedLaneRuns: result.passedLaneRuns,
    missingLaneRuns: result.missingLaneRuns,
    taskCount: result.taskCount,
    progressPct: Math.round((result.passedLaneRuns / result.requiredLaneRuns) * 100)
  },
  currentSeed: {
    label: "Seed case study",
    task: seedReplay?.task?.headline || "Customer 360 Escalation",
    scenario: result.currentSeed.scenario,
    status: result.currentSeed.status,
    measuredDeltas: [
      { label: "Extra AI reading", value: signed("Postgres", tokenDelta, "tokens"), evidenceId: "seed-traces" },
      { label: "Extra AI time", value: signed("Postgres", elapsedSeconds, "seconds"), evidenceId: "seed-traces" },
      { label: "Extra cleanup signs", value: signed("Postgres", retryDelta, "signals"), evidenceId: "seed-traces" },
      { label: "Code changed", value: diffDelta > 0 ? signed("Postgres", diffDelta, "bytes") : signed("MongoDB", Math.abs(diffDelta), "bytes"), evidenceId: "seed-diffs" }
    ],
    measuredNumbers: {
      estimatedTranscriptTokens: tokenDelta,
      elapsedSeconds,
      retrySignals: retryDelta,
      diffBytes: diffDelta
    },
    comparison: {
      verdict: "Codex passed both lanes. Postgres made the AI read 8,869 more estimated tokens, took 70 seconds longer, and showed 4 more cleanup signals. MongoDB changed 1,361 more bytes of code.",
      lanes: [
        {
          id: "mongo",
          label: "MongoDB",
          status: mongoLane.status || "unknown",
          estimatedTranscriptTokens: mongoLane.estimatedTranscriptTokens || 0,
          elapsedMs: mongoLane.elapsedMs || 0,
          retrySignals: mongoLane.retrySignals || 0,
          diffBytes: mongoLane.diffBytes || 0,
          filesChanged: mongoLane.filesChanged || 0,
          testStatus: mongoLane.testStatus || "unknown",
          artifacts: mongoLane.artifacts || {},
          trace: mongoTrace
        },
        {
          id: "postgres",
          label: "Postgres",
          status: postgresLane.status || "unknown",
          estimatedTranscriptTokens: postgresLane.estimatedTranscriptTokens || 0,
          elapsedMs: postgresLane.elapsedMs || 0,
          retrySignals: postgresLane.retrySignals || 0,
          diffBytes: postgresLane.diffBytes || 0,
          filesChanged: postgresLane.filesChanged || 0,
          testStatus: postgresLane.testStatus || "unknown",
          artifacts: postgresLane.artifacts || {},
          trace: postgresTrace
        }
      ],
      deltas: [
        {
          id: "tokens",
          label: "AI reading",
          winner: "MongoDB",
          value: signed("Postgres", tokenDelta, "tokens"),
          mongoValue: mongoLane.estimatedTranscriptTokens || 0,
          postgresValue: postgresLane.estimatedTranscriptTokens || 0,
          evidenceId: "seed-traces"
        },
        {
          id: "time",
          label: "AI time",
          winner: "MongoDB",
          value: signed("Postgres", elapsedSeconds, "seconds"),
          mongoValue: mongoLane.elapsedMs || 0,
          postgresValue: postgresLane.elapsedMs || 0,
          evidenceId: "seed-traces"
        },
        {
          id: "retries",
          label: "Cleanup signs",
          winner: "MongoDB",
          value: signed("Postgres", retryDelta, "signals"),
          mongoValue: mongoLane.retrySignals || 0,
          postgresValue: postgresLane.retrySignals || 0,
          evidenceId: "seed-traces"
        },
        {
          id: "diff",
          label: "Code changed",
          winner: "Postgres",
          value: diffDelta > 0 ? signed("Postgres", diffDelta, "bytes") : signed("MongoDB", Math.abs(diffDelta), "bytes"),
          mongoValue: mongoLane.diffBytes || 0,
          postgresValue: postgresLane.diffBytes || 0,
          evidenceId: "seed-diffs"
        }
      ]
    },
    agentEvidence: {
      agent: seed?.agent || seedReplay?.agent?.name || "Codex",
      modelOrRuntime: seedReplay?.agent?.model || "captured Codex CLI run",
      mongoCliVersion: mongoLane.cliVersion || "unavailable",
      postgresCliVersion: postgresLane.cliVersion || "unavailable",
      runId: seed?.runId || "order-exception-codex-v1"
    },
    processLoop: [
      {
        id: "prompt",
        label: "Same request",
        plain: "One business request enters both lanes.",
        evidenceId: "seed-traces"
      },
      {
        id: "context",
        label: "The AI reads",
        plain: "It has to understand the app, the data shape, the rules, and the test before it can safely write code.",
        evidenceId: "context-ledger"
      },
      {
        id: "agent-work",
        label: "The AI tries",
        plain: "Every look-around, test run, correction, and retry is captured from the raw Codex trace.",
        evidenceId: "seed-traces"
      },
      {
        id: "diff",
        label: "Code changes",
        plain: "Only product source changes count. Test edits and fixture edits invalidate the lane.",
        evidenceId: "seed-diffs"
      },
      {
        id: "proof",
        label: "Proof",
        plain: "Acceptance, DB before/after, and rendered customer state prove the workflow moved data.",
        evidenceId: "database-proof"
      },
      {
        id: "receipt",
        label: "Cost receipt",
        plain: "Measured deltas feed the receipt; sliders only change visible assumptions.",
        evidenceId: "cost-model"
      }
    ],
    contextLedger: buildContextLedger({
      mongoLane,
      postgresLane,
      mongoTrace,
      postgresTrace
    }),
    customerCaveat: "Single verified replay. Same task, same agent, same acceptance test. Not a promise of savings.",
    caveat: "This seed case is real evidence, but it is not the V1 benchmark result.",
    sources: result.currentSeed.sources || []
  },
  aggregate: result.aggregate,
  tasks: result.tasks,
  agents: result.agents,
  fairnessRules: suite.fairnessRules,
  evidenceClaims: [
    {
      id: "benchmark-contract",
      label: "Proof boundary",
      question: "What is proven today?",
      verdict: `This customer demo proves one verified Codex replay pair. The broader AST-Bench benchmark still requires ${result.requiredLaneRuns} lane runs; ${result.passedLaneRuns} are currently passed.`,
      sources: [source("benchmark/specs/ast-bench-v1.json"), source(resultPath)]
    },
    {
      id: "seed-traces",
      label: "Seed Codex traces",
      question: "Is the current seed replay real?",
      verdict: seedBundle?.claims?.find((claim) => claim.id === "codex-traces")?.verdict || "Seed trace evidence is captured from Codex run artifacts.",
      sources: [
        source("instrumented-agent-runs/order-exception-codex-v1/mongo/raw-transcript/codex-events.jsonl"),
        source("instrumented-agent-runs/order-exception-codex-v1/postgres/raw-transcript/codex-events.jsonl"),
        source(seedRunSummaryPath)
      ]
    },
    {
      id: "seed-diffs",
      label: "Seed code diffs",
      question: "What did the agent actually change?",
      verdict: seedBundle?.claims?.find((claim) => claim.id === "code-diffs")?.verdict || "Seed diffs are preserved for both database lanes.",
      sources: [
        source("instrumented-agent-runs/order-exception-codex-v1/mongo/diff.patch"),
        source("instrumented-agent-runs/order-exception-codex-v1/postgres/diff.patch")
      ]
    },
    {
      id: "context-ledger",
      label: "What the AI had to read",
      question: "Which files and context did the agent have to understand?",
      verdict: `Seed trace shows ${mongoTrace.commands.length} MongoDB work events and ${postgresTrace.commands.length} Postgres work events. The file list is hashable evidence, not a slide.`,
      sources: [
        source(mongoLane.artifacts?.rawTranscript || ""),
        source(postgresLane.artifacts?.rawTranscript || ""),
        source("instrumented-agent-runs/order-exception-codex-v1/mongo/workspace/AGENTS.md"),
        source("instrumented-agent-runs/order-exception-codex-v1/postgres/workspace/AGENTS.md")
      ]
    },
    {
      id: "stack-comparison",
      label: "One data plane vs stitched stack",
      question: "Should the benchmark compare MongoDB only to Postgres, or to Postgres plus search plus vector systems?",
      verdict: "The current measured seed is MongoDB versus Postgres. The next benchmark design should add a realistic stitched-stack lane before making any public claim about Elastic or Pinecone.",
      sources: [source(suitePath), source(resultPath)]
    },
    {
      id: "database-proof",
      label: "Local database proof",
      question: "Did the seed evidence touch real local databases?",
      verdict: seedBundle?.claims?.find((claim) => claim.id === "database-replays")?.verdict || "Local DB proof files are required evidence.",
      sources: [
        source("data/generated/proof/mongodb-local-db-proof.json"),
        source("data/generated/proof/postgres-local-db-proof.json")
      ]
    },
    {
      id: "design-review",
      label: "Database-native design review",
      question: "Is Postgres being treated credibly?",
      verdict: "Every benchmark task requires a database-native design review before public promotion.",
      sources: [source("design-review/order-exception-v1.json"), source("benchmark/design-reviews/ast-bench-v1.json")]
    },
    {
      id: "cost-model",
      label: "Cost model",
      question: "What part is measured and what part is assumed?",
      verdict: `Seed projection is ${formatMoneyShort(result.costModel.monthlyDeltaUsd)} monthly under visible assumptions. The measured inputs come from the captured replay; monthly scale and review cost are editable assumptions.`,
      sources: [source(seedRunSummaryPath), source(resultPath)]
    },
    {
      id: "anti-cheat-gates",
      label: "Anti-cheat gates",
      question: "Can the page overclaim?",
      verdict: "The benchmark gates block public-v1 labels without the required run count and evidence files.",
      sources: [source("scripts/benchmark-gates.mjs"), source("scripts/test-benchmark-gates.mjs")]
    }
  ],
  costModel: {
    ...result.costModel,
    publicLabel: `${formatMoneyShort(result.costModel.monthlyDeltaUsd)} projected monthly impact under your assumptions`,
    caveat: "Projection uses measured replay deltas plus visible assumptions. It is not a promise of savings."
  },
  metricDefinitions: [
    {
      id: "context-tokens",
      label: "What the AI had to read",
      plain: "Estimated context in the captured agent transcript. More reading means more model budget and more chances to misunderstand the system.",
      evidenceId: "seed-traces"
    },
    {
      id: "retry-signals",
      label: "Human babysitting pressure",
      plain: "Signals like error, failed, retry, fix, and fail in the captured run. It is a proxy for cleanup pressure, not a correctness score by itself.",
      evidenceId: "seed-traces"
    },
    {
      id: "review-rate",
      label: "Review rate / hour",
      plain: "The loaded hourly cost of a person checking AI output. It is a visible assumption slider, not a measured runtime fact.",
      evidenceId: "cost-model"
    },
    {
      id: "diff-size",
      label: "Code changed",
      plain: "Bytes changed in the accepted source diff. This is the mixed metric: MongoDB changed more code in this run, so the page shows it openly.",
      evidenceId: "seed-diffs"
    }
  ],
  strategy: {
    nextV1Move: "Run the full 25 task x 2 database lane x 3 agent x 3 repeat matrix, then publish only aggregate measured results.",
    stressLadder: [
      {
        id: "v1",
        label: "V1 benchmark",
        scale: "25 tasks, native schemas, 450 lane runs",
        status: result.status,
        publicClaim: "Seed/case-study until every required lane is captured."
      },
      {
        id: "enterprise-100",
        label: "Enterprise stress tier",
        scale: "100+ schema objects per domain",
        status: "planned",
        publicClaim: "No claim until measured."
      },
      {
        id: "enterprise-1000",
        label: "1,000 object stress tier",
        scale: "1,000 tables or collections, migration/history files, schema docs, and noisy legacy modules",
        status: "planned",
        publicClaim: "Designed to test whether the effect grows with enterprise complexity."
      }
    ]
  },
  reproduction: [
    { label: "Validate suite", command: "npm run benchmark:validate" },
    { label: "Prepare all target templates", command: "npm run benchmark:prepare" },
    { label: "Run one Codex seed-style cell", command: "npm run benchmark:run -- --task strategic-account-rescue --lane mongo --agent codex --repeat 1" },
    { label: "Score captured runs", command: "npm run benchmark:score" },
    { label: "Check promotion gates", command: "npm run benchmark:gates" }
  ],
  caveats: result.caveats
};

writeJson(publicBundlePath, bundle);
writeJson(labBundlePath, bundle);
console.log(`AST-Bench public bundle emitted: ${publicBundlePath} (${bundle.status})`);

function signed(label, value, unit) {
  const amount = Math.abs(Number(value) || 0).toLocaleString("en-US");
  return `${label} +${amount} ${unit}`;
}

function buildContextLedger({ mongoLane, postgresLane, mongoTrace, postgresTrace }) {
  return [
    ...laneContext("mongo", "MongoDB", mongoLane, mongoTrace, [
      ["Prompt", "Business request given to the agent", "prompt"],
      ["Run rules", "What the agent was allowed to change", "workspace/AGENTS.md"],
      ["Workspace README", "Before-state instructions", "workspace/README.md"],
      ["Document fixture", "Collections and product state", "workspace/data/collections.json"],
      ["Portal projection", "Customer-facing state builder", "workspace/src/portal-view.mjs"],
      ["Workflow source", "File changed by the agent", "workspace/src/order-exception-workflow.mjs"],
      ["Acceptance test", "Same behavior gate", "workspace/tests/customer-360-escalation.test.mjs"],
      ["Raw trace", "Codex command and message stream", "rawTranscript"],
      ["Diff", "Accepted source patch", "diff"],
      ["Tests", "Final acceptance output", "tests"]
    ]),
    ...laneContext("postgres", "Postgres", postgresLane, postgresTrace, [
      ["Prompt", "Business request given to the agent", "prompt"],
      ["Run rules", "What the agent was allowed to change", "workspace/AGENTS.md"],
      ["Workspace README", "Before-state instructions", "workspace/README.md"],
      ["Table fixture", "Normalized tables and product state", "workspace/data/tables.json"],
      ["Portal projection", "Customer-facing state builder", "workspace/src/portal-view.mjs"],
      ["Workflow source", "File changed by the agent", "workspace/src/order-exception-workflow.mjs"],
      ["Acceptance test", "Same behavior gate", "workspace/tests/customer-360-escalation.test.mjs"],
      ["Raw trace", "Codex command and message stream", "rawTranscript"],
      ["Diff", "Accepted source patch", "diff"],
      ["Tests", "Final acceptance output", "tests"]
    ])
  ];
}

function laneContext(lane, laneLabel, laneSummary, trace, rows) {
  const artifacts = laneSummary.artifacts || {};
  const workspace = artifacts.workspace || `instrumented-agent-runs/order-exception-codex-v1/${lane}/workspace`;
  return rows.map(([label, purpose, key]) => {
    const path = artifacts[key] || (key.startsWith("workspace/") ? `${workspace}/${key.slice("workspace/".length)}` : "");
    const src = source(path);
    return {
      lane,
      laneLabel,
      label,
      purpose,
      observedInTrace: trace.files.some((file) => path.endsWith(file)) || trace.commands.some((command) => command.command.includes(key.split("/").at(-1))),
      estimatedTokens: Math.ceil((src.bytes || 0) / 4),
      source: src
    };
  });
}

function parseTrace(path, lane) {
  const empty = { lane, commands: [], files: [], failedCommandCount: 0 };
  if (!path || !existsSync(path)) return empty;
  const text = readFileSync(path, "utf8");
  const commands = [];
  const files = new Set();
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const item = event.item;
    if (item?.type !== "command_execution" || event.type !== "item.completed") continue;
    const command = item.command || "";
    const output = item.aggregated_output || "";
    commands.push({
      id: item.id,
      command,
      exitCode: Number(item.exit_code ?? 0),
      outputBytes: Buffer.byteLength(output, "utf8")
    });
    for (const file of filesFromCommand(command, output)) files.add(file);
  }
  return {
    lane,
    commands,
    files: [...files].sort(),
    failedCommandCount: commands.filter((command) => command.exitCode !== 0).length
  };
}

function filesFromCommand(command, output) {
  const files = new Set();
  for (const match of command.matchAll(/\b(?:sed|cat|nl)\b[^'"]*['"]?([A-Za-z0-9_./-]+\.(?:mjs|json|md|sql|js|ts))['"]?/g)) {
    files.add(match[1].replace(/^\.\//, ""));
  }
  if (/rg --files/.test(command)) {
    for (const line of output.split(/\r?\n/)) {
      if (/\.(mjs|json|md|sql|js|ts)$/.test(line.trim())) files.add(line.trim().replace(/^\.\//, ""));
    }
  }
  for (const match of output.matchAll(/\b([A-Za-z0-9_./-]+\.(?:mjs|json|md|sql|js|ts))\b/g)) {
    const file = match[1].replace(/^\.\//, "");
    if (!file.includes("node_modules")) files.add(file);
  }
  return files;
}
