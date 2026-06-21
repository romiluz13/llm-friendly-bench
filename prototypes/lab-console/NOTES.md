# Lab Console Prototype Notes

Question: does Forensic Mission Control, with an outcome-first strip and embedded proof case file, create the strongest seller/customer aha moment?

Current answer: yes enough to keep investing. The first viewport should stay outcome-first and comparison-led. The lower proof layer should act like a case file: fairness controls, independent design review, and an evidence ledger that names the source behind every claim.

Guardrail: this prototype must not call mocked numbers verified. A replay artifact can move to `proofStatus: "verified"` only after the validator accepts captured or verified evidence, controls, design review, raw Codex trace, diffs, tests, screenshots, and Proof Packet items.

Run:

```sh
npm run proof:all
npm run instrumented:prepare
npm run instrumented:codex:all
npm run proof:verified
npm run proof:no-mock
python3 -m http.server 4173 --bind 127.0.0.1 --directory prototypes/lab-console
```

Verified replay path:

```sh
npm run instrumented:prepare
npm run instrumented:codex:all
npm run proof:verified
```

The verified replay is `prototypes/lab-console/replays/order-exception-codex-v1-verified.json`. The Lab Console fails closed if that artifact is missing; it does not render an unverified runtime fallback.

Local database path:

```sh
npm run db:up:mongo
npm run proof:mongo:db
npm run proof:all
```

The MongoDB local path seeds real collections, runs the workflow through `mongosh`, captures `data/generated/proof/mongodb-local-db-proof.json`, and then refreshes the replay artifact so the Proof Packet marks MongoDB local DB replay as captured.

Full local DB seeding is also available:

```sh
npm run db:up
npm run db:seed
```

Postgres-local workflow proof is implemented separately:

```sh
npm run db:up:postgres
npm run proof:postgres:db
npm run proof:all
```

The local DB path uses isolated Docker ports: MongoDB on `127.0.0.1:27018` and Postgres on `127.0.0.1:5433`.
