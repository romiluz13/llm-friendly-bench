#!/usr/bin/env node

import { generateFixtureArtifacts } from "./proof-fixtures.mjs";

const { fixture, mongo, postgres } = generateFixtureArtifacts();

console.log(`Generated ${fixture.scenarioVersion}`);
console.log(`MongoDB collections: ${Object.keys(mongo).length}`);
console.log(`Postgres tables: ${Object.keys(postgres).length}`);
