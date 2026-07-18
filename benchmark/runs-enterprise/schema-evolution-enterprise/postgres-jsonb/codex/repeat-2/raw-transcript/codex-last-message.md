Implemented `preferredPaymentMethod` across the account schema, account create/update model, and order summary output.

Tests remain blocked by the enterprise schema’s invoice constraints during fixture insertion; the test inserts JSON documents while the generated relational invoice table requires additional fields.