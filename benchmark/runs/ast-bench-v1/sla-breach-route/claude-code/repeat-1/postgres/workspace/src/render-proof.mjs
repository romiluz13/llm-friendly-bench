import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { applyBenchmarkTask } from "./workflow.mjs";
import { buildPortalView } from "./portal-view.mjs";

const now = "2026-06-18T12:00:00.000Z";
const data = JSON.parse(readFileSync(new URL("../data/tables.json", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data));
const runData = structuredClone(data);
const after = applyBenchmarkTask(runData, now);

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/before-after.json", JSON.stringify({ lane: "postgres", before, after }, null, 2) + "\n");
writeFileSync("artifacts/before-after.svg", svg({ before, after }));

function svg({ before, after }) {
  const rows = [
    ["Status", before.status, after.status],
    ["Owner", before.owner, after.owner],
    ["Next", before.nextStep, after.nextStep],
    ["Risk", before.riskSummary, after.riskSummary],
    ["Tasks", before.tasks, after.tasks],
    ["Audit", before.history, after.history]
  ];
  const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const body = rows.map((row, index) => {
    const y = 160 + index * 58;
    return `<text x="52" y="${y}" class="k">${esc(row[0])}</text><text x="180" y="${y}" class="v">${esc(row[1])}</text><text x="620" y="${y}" class="g">${esc(row[2])}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="560" viewBox="0 0 1080 560">
    <style>.bg{fill:#0f1412}.card{fill:#f5f1e8;stroke:#d9d2bf}.h{font:800 28px system-ui;fill:#f5f1e8}.s{font:600 14px system-ui;fill:#b9c1b1}.k{font:700 14px system-ui;fill:#5a6256}.v{font:650 14px system-ui;fill:#171b17}.g{font:750 14px system-ui;fill:#087a4a}.line{stroke:#d9d2bf}</style>
    <rect class="bg" width="1080" height="560"/>
    <text x="40" y="50" class="h">AST-Bench Workflow State</text>
    <text x="40" y="78" class="s">postgres target / deterministic fixture / captured by render script</text>
    <rect x="36" y="104" width="1008" height="390" rx="6" class="card"/>
    <text x="180" y="124" class="k">Before</text><text x="620" y="124" class="k">After</text>
    <line x1="150" y1="134" x2="150" y2="470" class="line"/><line x1="590" y1="134" x2="590" y2="470" class="line"/>
    ${body}
  </svg>`;
}
