#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { generateFixtureArtifacts } from "./proof-fixtures.mjs";

const mode = process.argv[2] || "all";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/sql_hidden_cost";
const postgresContainer = process.env.POSTGRES_CONTAINER || "sql-hidden-cost-postgres";
const postgresUser = process.env.POSTGRES_USER || "lab";
const postgresDb = process.env.POSTGRES_DB || "sql_hidden_cost";

if (!["all", "mongo", "postgres"].includes(mode)) {
  throw new Error(`Unknown seed mode "${mode}". Use all, mongo, or postgres.`);
}

const { fixture, mongo, postgres } = generateFixtureArtifacts();

mkdirSync("data/generated/mongodb", { recursive: true });
mkdirSync("data/generated/postgres", { recursive: true });

const mongoSeedPath = "data/generated/mongodb/seed.mongo.js";
const postgresSeedPath = "data/generated/postgres/seed.sql";

writeFileSync(mongoSeedPath, buildMongoSeedScript({ fixture, mongo }));
writeFileSync(postgresSeedPath, buildPostgresSeedSql(postgres));

if (mode === "all" || mode === "mongo") {
  run("mongosh", [mongoUri, mongoSeedPath]);
  console.log(`Seeded MongoDB ${mongoUri} from ${fixture.scenarioVersion}`);
}

if (mode === "all" || mode === "postgres") {
  const resetAndSeedSql = [
    "DROP SCHEMA IF EXISTS public CASCADE;",
    "CREATE SCHEMA public;",
    readFileSync("targets/postgres-app/schema/schema.sql", "utf8"),
    readFileSync(postgresSeedPath, "utf8")
  ].join("\n\n");

  run("docker", ["exec", "-i", postgresContainer, "psql", "-v", "ON_ERROR_STOP=1", "-U", postgresUser, "-d", postgresDb], {
    input: resetAndSeedSql
  });
  console.log(`Seeded Postgres ${postgresContainer}/${postgresDb} from ${fixture.scenarioVersion}`);
}

function buildMongoSeedScript({ fixture, mongo }) {
  const collections = JSON.stringify(mongo, null, 2);
  return `const fixtureVersion = ${JSON.stringify(fixture.scenarioVersion)};
const collections = ${collections};

for (const name of Object.keys(collections)) {
  db.getCollection(name).deleteMany({});
  if (collections[name].length > 0) {
    db.getCollection(name).insertMany(collections[name].map((doc) => ({ ...doc, fixtureVersion })));
  }
}

printjson(Object.fromEntries(Object.keys(collections).map((name) => [name, db.getCollection(name).countDocuments({ fixtureVersion })])));
`;
}

function buildPostgresSeedSql(tables) {
  const tableNames = Object.keys(tables);
  const statements = [
    `TRUNCATE ${tableNames.map((name) => quoteIdent(name)).join(", ")} RESTART IDENTITY CASCADE;`
  ];

  for (const [table, rows] of Object.entries(tables)) {
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    const values = rows.map((row) => `(${columns.map((column) => sqlValue(row[column])).join(", ")})`);
    statements.push(`INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES\n${values.join(",\n")};`);
  }

  return `${statements.join("\n\n")}\n`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return `${sqlString(JSON.stringify(value))}::jsonb`;
  return sqlString(value);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.input ? ["pipe", "pipe", "pipe"] : "pipe",
    input: options.input,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
