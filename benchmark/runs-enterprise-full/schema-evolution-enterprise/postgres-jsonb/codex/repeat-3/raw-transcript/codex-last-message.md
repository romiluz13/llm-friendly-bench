Implemented the optional account `preferredPaymentMethod` enum and exposed it in `getOrderSummary`.

Also corrected the existing schema creation order for `product_categories` / `products`, which was blocking database initialization.

Verification: `npm test` passes.