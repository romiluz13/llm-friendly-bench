import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  // TODO: Implement the benchmark workflow against the native data shape.
  return buildPortalView(db);
}
