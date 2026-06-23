import assert from "node:assert";
import { SHAPES, shapeMeta } from "./benchmark-shapes.mjs";
assert.deepStrictEqual(SHAPES, ["shallow","moderate","deep"], "three shapes in depth order");
const counts = SHAPES.map((s) => shapeMeta(s).postgresTableCount);
assert(counts[0] < counts[1] && counts[1] < counts[2], "postgres table count strictly increases with depth");
assert(shapeMeta("deep").postgresTableCount >= 10, "deep shape has >=10 tables (10+ joins to reconstruct)");
assert(shapeMeta("shallow").label && shapeMeta("deep").normalization, "meta has label + normalization note");
console.log("shapes ok");
