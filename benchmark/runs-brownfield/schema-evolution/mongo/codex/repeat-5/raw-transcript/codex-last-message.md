Inspection confirms `accounts.mjs` already preserves a supplied `riskScore` on create, returns it on get, and applies it on update.

Recommended minimal design:

- Add optional `riskScore` to the JSON Schema as BSON `int`, minimum `0`, maximum `100`.
- Update the live collection validator with `collMod` when `accounts` already exists; otherwise the change only affects newly created databases.
- Leave the existing CRUD implementation intact and run the acceptance suite.

Approve this design and I’ll implement and verify it.