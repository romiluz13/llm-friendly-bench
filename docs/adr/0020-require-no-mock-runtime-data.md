# Require no-mock runtime data

Seller V1 must fail closed unless the Lab Console can render a verified replay backed by captured runtime evidence. The console must not ship the retired prototype replay, placeholder proof rows, or an unverified fallback path. A verified replay now requires a no-mock runtime data contract that names the local MongoDB service, local Postgres service, Codex traces, diffs, tests, screenshots, and hash-locked evidence manifest used as sources.

This does not mean customer production data is required for Seller V1. The scenario records are generated business data, then seeded into real local MongoDB and Postgres services and exercised by real proof runners. Customer data remains out of scope until a customer explicitly approves a private run.
