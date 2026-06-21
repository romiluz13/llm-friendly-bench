import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { applyOrderException } from "./order-exception-workflow.mjs";
import { buildPortalView } from "./portal-view.mjs";

const now = "2026-06-17T12:00:00.000Z";
const orderId = "HX-20491";
const data = JSON.parse(readFileSync(new URL("../data/tables.json", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data), orderId);
const after = applyOrderException(structuredClone(data), orderId, now);

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/customer-portal-before-after.json", JSON.stringify({ lane: "postgres", before, after }, null, 2) + "\n");
writeFileSync("artifacts/customer-portal-before-after.svg", svg({ lane: "postgres", before, after }));

function svg({ lane, before, after }) {
  const rows = [
    ["Status", before.status, after.status],
    ["Owner", before.owner, after.owner],
    ["Next step", before.nextStep, after.nextStep],
    ["History", before.history, after.history],
    ["Risk", before.riskSummary, after.riskSummary],
    ["Tasks", before.tasks, after.tasks]
  ];
  const escaped = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const rowSvg = rows.map((row, index) => {
    const y = 196 + index * 58;
    return `<text x="70" y="${y}" class="k">${escaped(row[0])}</text><text x="230" y="${y}" class="v">${escaped(row[1])}</text><text x="650" y="${y}" class="v good">${escaped(row[2])}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="650" viewBox="0 0 1180 650">
  <style>
    .bg{fill:#111311}.panel{fill:#f4f1e8;stroke:#d8d0bd}.h{font:700 30px system-ui;fill:#f4f1e8}.sub{font:600 14px system-ui;fill:#a9af9d}.title{font:800 25px system-ui;fill:#151711}.k{font:700 15px system-ui;fill:#5f6659}.v{font:700 15px system-ui;fill:#151711}.good{fill:#0a7f4b}.label{font:800 12px system-ui;fill:#5f6659;letter-spacing:2px}.line{stroke:#d8d0bd}
  </style>
  <rect width="1180" height="650" class="bg"/>
  <text x="48" y="58" class="h">Customer 360 Escalation Proof Snapshot</text>
  <text x="48" y="86" class="sub">${escaped(lane)} lane / Order HX-20491 / Instrumented Agent Run artifact</text>
  <rect x="48" y="122" width="510" height="444" class="panel"/>
  <rect x="620" y="122" width="510" height="444" class="panel"/>
  <text x="70" y="154" class="label">BEFORE</text><text x="642" y="154" class="label">AFTER</text>
  <text x="70" y="118" class="title">${escaped(before.title)}</text>
  <text x="642" y="118" class="title">${escaped(after.title)}</text>
  <line x1="200" y1="168" x2="200" y2="532" class="line"/><line x1="620" y1="168" x2="620" y2="532" class="line"/>
  ${rowSvg}
</svg>`;
}
