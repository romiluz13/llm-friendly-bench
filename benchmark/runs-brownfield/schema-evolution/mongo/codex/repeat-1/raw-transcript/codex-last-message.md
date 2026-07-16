Added optional `riskScore` validation (`int`, 0–100) and ensured existing collections are migrated via `collMod`. Create and update preserve `riskScore`; get already returns it.

Verified with `npm test` — all acceptance tests pass.