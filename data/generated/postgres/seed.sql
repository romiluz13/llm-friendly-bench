TRUNCATE "account_tiers", "owner_groups", "accounts", "contacts", "contact_preferences", "account_contracts", "account_team_members", "account_risk_flags", "account_health_scores", "account_health_factors", "account_notes", "products", "product_categories", "product_category_memberships", "subscriptions", "entitlements", "orders", "order_items", "shipments", "shipment_events", "shipment_regulatory_flags", "payments", "payment_events", "invoices", "invoice_line_items", "payment_risk_events", "usage_snapshots", "usage_products", "support_cases", "case_comments", "support_case_links", "activities", "activity_participants", "compliance_reviews", "compliance_review_flags", "escalation_policies", "escalation_policy_steps", "customer_escalations", "escalation_risk_factors", "escalation_tasks", "escalation_task_assignments", "customer_portal_messages", "executive_notifications", "legal_review_requests", "finance_review_requests", "success_plan_milestones", "renewal_events", "order_status_history", "audit_events", "audit_subjects", "sla_policies", "sla_timers", "inventory_locations", "inventory_reservations", "portal_visibility_rules", "notification_outbox" RESTART IDENTITY CASCADE;

INSERT INTO "account_tiers" ("tier_id", "label", "review_minutes") VALUES
('strategic', 'strategic', 60),
('enterprise', 'enterprise', 30),
('growth', 'growth', 15),
('commercial', 'commercial', 15);

INSERT INTO "owner_groups" ("owner_group", "label") VALUES
('Customer Success', 'Customer Success'),
('Legal', 'Legal'),
('Finance', 'Finance'),
('Support', 'Support'),
('Operations', 'Operations'),
('Sales', 'Sales');

INSERT INTO "accounts" ("account_id", "tier_id", "name", "segment", "region") VALUES
('acct-nova', 'strategic', 'Nova Retail Group', 'retail', 'NA'),
('acct-helio', 'enterprise', 'Helio Medical Devices', 'medical-devices', 'EU'),
('acct-polaris', 'growth', 'Polaris Field Systems', 'industrial', 'NA'),
('acct-cascade', 'commercial', 'Cascade Outfitters', 'commerce', 'APAC');

INSERT INTO "contacts" ("contact_id", "account_id", "name", "role", "email") VALUES
('ct-nova-ops', 'acct-nova', 'Ari Cohen', 'VP Operations', 'ari.cohen@nova.example'),
('ct-nova-fin', 'acct-nova', 'Maya Rosen', 'Finance Controller', 'maya.rosen@nova.example'),
('ct-nova-care', 'acct-nova', 'Sam Ortega', 'Customer Care Lead', 'sam.ortega@nova.example'),
('ct-nova-cio', 'acct-nova', 'Priya Menon', 'CIO', 'priya.menon@nova.example'),
('ct-helio-proc', 'acct-helio', 'Elena Martins', 'Procurement', 'elena.martins@helio.example'),
('ct-helio-qa', 'acct-helio', 'Jon Bell', 'Quality', 'jon.bell@helio.example'),
('ct-polaris-ops', 'acct-polaris', 'Nia Brooks', 'Operations', 'nia.brooks@polaris.example'),
('ct-polaris-it', 'acct-polaris', 'Luca Singh', 'IT', 'luca.singh@polaris.example'),
('ct-cascade-ops', 'acct-cascade', 'Talia Chen', 'Operations', 'talia.chen@cascade.example'),
('ct-cascade-cx', 'acct-cascade', 'Bo Kim', 'Customer Experience', 'bo.kim@cascade.example');

INSERT INTO "contact_preferences" ("contact_id", "channel", "enabled") VALUES
('ct-nova-ops', 'email', TRUE),
('ct-nova-fin', 'email', TRUE),
('ct-nova-care', 'email', TRUE),
('ct-nova-cio', 'email', TRUE),
('ct-helio-proc', 'email', TRUE),
('ct-helio-qa', 'email', TRUE),
('ct-polaris-ops', 'email', TRUE),
('ct-polaris-it', 'email', TRUE),
('ct-cascade-ops', 'email', TRUE),
('ct-cascade-cx', 'email', TRUE);

INSERT INTO "account_contracts" ("contract_id", "account_id", "contract_tier", "arr_cents", "renewal_date", "executive_sponsor", "support_plan", "data_processing_addendum") VALUES
('ctr-nova-2026', 'acct-nova', 'enterprise-plus', 18400000, '2026-07-31', 'Dana Weiss', 'platinum', TRUE),
('ctr-helio-2026', 'acct-helio', 'enterprise', 9200000, '2026-10-15', 'Mira Stone', 'premium', TRUE),
('ctr-polaris-2026', 'acct-polaris', 'growth', 3100000, '2027-01-31', 'Leo Park', 'standard', FALSE),
('ctr-cascade-2026', 'acct-cascade', 'commercial', 860000, '2026-11-30', 'Kim Lau', 'standard', FALSE);

INSERT INTO "account_team_members" ("member_id", "account_id", "owner_group", "name", "role") VALUES
('team-acct-nova-customer-success', 'acct-nova', 'Customer Success', 'Leah Gordon', 'Strategic CSM'),
('team-acct-nova-legal', 'acct-nova', 'Legal', 'Owen Blake', 'Commercial Counsel'),
('team-acct-nova-finance', 'acct-nova', 'Finance', 'Rina Shah', 'Collections Lead'),
('team-acct-nova-support', 'acct-nova', 'Support', 'Marta Silva', 'Support Duty Manager'),
('team-acct-helio-customer-success', 'acct-helio', 'Customer Success', 'Nico Hart', 'Enterprise CSM'),
('team-acct-helio-support', 'acct-helio', 'Support', 'Iris Bell', 'Support Lead'),
('team-acct-polaris-customer-success', 'acct-polaris', 'Customer Success', 'Ava Trent', 'Growth CSM'),
('team-acct-cascade-customer-success', 'acct-cascade', 'Customer Success', 'Bo Kim', 'Commercial CSM');

INSERT INTO "account_risk_flags" ("account_id", "risk_flag") VALUES
('acct-nova', 'regulated-shipping'),
('acct-nova', 'public-company'),
('acct-nova', 'renewal-at-risk'),
('acct-helio', 'regulated-shipping'),
('acct-helio', 'sla-critical'),
('acct-polaris', 'field-critical');

INSERT INTO "account_health_scores" ("account_id", "score", "trend", "summary", "captured_at") VALUES
('acct-nova', 61, 'down', 'Usage down while renewal and delayed regulated shipment are active.', '2026-06-17T00:00:00.000Z'),
('acct-helio', 82, 'stable', 'Regulated customer with healthy usage.', '2026-06-17T00:00:00.000Z'),
('acct-polaris', 74, 'stable', 'Operational delay without strategic escalation criteria.', '2026-06-17T00:00:00.000Z'),
('acct-cascade', 89, 'up', 'Healthy commercial account.', '2026-06-17T00:00:00.000Z');

INSERT INTO "account_health_factors" ("account_id", "factor", "value") VALUES
('acct-nova', 'contract_tier', 'enterprise-plus'),
('acct-nova', 'arr_cents', '18400000'),
('acct-nova', 'usage_trend', 'down'),
('acct-helio', 'contract_tier', 'enterprise'),
('acct-helio', 'arr_cents', '9200000'),
('acct-helio', 'usage_trend', 'stable'),
('acct-polaris', 'contract_tier', 'growth'),
('acct-polaris', 'arr_cents', '3100000'),
('acct-polaris', 'usage_trend', 'stable'),
('acct-cascade', 'contract_tier', 'commercial'),
('acct-cascade', 'arr_cents', '860000'),
('acct-cascade', 'usage_trend', 'up');

INSERT INTO "products" ("product_id", "name", "unit_price_cents") VALUES
('prd-coldchain-kit', 'Cold Chain Sensor Kit', 128000),
('prd-gateway-pro', 'Gateway Pro', 78000),
('prd-support-plus', 'Priority Support Plus', 240000),
('prd-field-case', 'Rugged Field Case', 18000),
('prd-analytics', 'Fleet Analytics Pack', 96000);

INSERT INTO "product_categories" ("category_id", "label") VALUES
('regulated', 'regulated'),
('hardware', 'hardware'),
('service', 'service'),
('software', 'software');

INSERT INTO "product_category_memberships" ("product_id", "category_id") VALUES
('prd-coldchain-kit', 'regulated'),
('prd-gateway-pro', 'hardware'),
('prd-support-plus', 'service'),
('prd-field-case', 'hardware'),
('prd-analytics', 'software');

INSERT INTO "subscriptions" ("subscription_id", "account_id", "contract_id", "product_family", "status") VALUES
('sub-acct-nova', 'acct-nova', 'ctr-nova-2026', 'customer-operations-platform', 'active'),
('sub-acct-helio', 'acct-helio', 'ctr-helio-2026', 'customer-operations-platform', 'active'),
('sub-acct-polaris', 'acct-polaris', 'ctr-polaris-2026', 'customer-operations-platform', 'active'),
('sub-acct-cascade', 'acct-cascade', 'ctr-cascade-2026', 'customer-operations-platform', 'active');

INSERT INTO "entitlements" ("entitlement_id", "subscription_id", "feature", "enabled") VALUES
('ent-acct-nova-support', 'sub-acct-nova', 'platinum', TRUE),
('ent-acct-helio-support', 'sub-acct-helio', 'premium', TRUE),
('ent-acct-polaris-support', 'sub-acct-polaris', 'standard', TRUE),
('ent-acct-cascade-support', 'sub-acct-cascade', 'standard', TRUE);

INSERT INTO "orders" ("order_id", "account_id", "contact_id", "created_at", "current_status", "value_cents", "currency") VALUES
('HX-20491', 'acct-nova', 'ct-nova-ops', '2026-06-14T09:12:00.000Z', 'delayed', 872000, 'USD'),
('HX-20472', 'acct-helio', 'ct-helio-proc', '2026-06-13T13:34:00.000Z', 'in_fulfillment', 612000, 'EUR'),
('HX-20388', 'acct-polaris', 'ct-polaris-ops', '2026-06-11T16:22:00.000Z', 'delayed', 128000, 'USD'),
('HX-20371', 'acct-cascade', 'ct-cascade-cx', '2026-06-10T10:01:00.000Z', 'delivered', 384000, 'USD');

INSERT INTO "order_items" ("order_id", "product_id", "quantity") VALUES
('HX-20491', 'prd-coldchain-kit', 4),
('HX-20491', 'prd-gateway-pro', 3),
('HX-20491', 'prd-support-plus', 1),
('HX-20472', 'prd-coldchain-kit', 2),
('HX-20472', 'prd-analytics', 2),
('HX-20388', 'prd-field-case', 2),
('HX-20388', 'prd-gateway-pro', 1),
('HX-20371', 'prd-analytics', 4);

INSERT INTO "shipments" ("shipment_id", "order_id", "carrier", "delayed", "delay_reason", "promised_release_time") VALUES
('ship-HX-20491', 'HX-20491', 'Northstar Compliance Freight', TRUE, 'customs_hold', '2026-06-17T16:00:00.000Z'),
('ship-HX-20472', 'HX-20472', 'Northstar Compliance Freight', FALSE, NULL, NULL),
('ship-HX-20388', 'HX-20388', 'MetroShip', TRUE, 'carrier_capacity', '2026-06-17T11:30:00.000Z'),
('ship-HX-20371', 'HX-20371', 'MetroShip', FALSE, NULL, NULL);

INSERT INTO "shipment_events" ("event_id", "shipment_id", "event_type", "occurred_at") VALUES
('ship-event-HX-20491-current', 'ship-HX-20491', 'delayed', '2026-06-14T09:12:00.000Z'),
('ship-event-HX-20472-current', 'ship-HX-20472', 'in_transit', '2026-06-13T13:34:00.000Z'),
('ship-event-HX-20388-current', 'ship-HX-20388', 'delayed', '2026-06-11T16:22:00.000Z'),
('ship-event-HX-20371-current', 'ship-HX-20371', 'in_transit', '2026-06-10T10:01:00.000Z');

INSERT INTO "shipment_regulatory_flags" ("shipment_id", "flag") VALUES
('ship-HX-20491', 'regulated-shipping'),
('ship-HX-20472', 'regulated-shipping');

INSERT INTO "payments" ("payment_id", "order_id", "status", "amount_cents") VALUES
('pay-HX-20491', 'HX-20491', 'captured', 872000),
('pay-HX-20472', 'HX-20472', 'captured', 612000),
('pay-HX-20388', 'HX-20388', 'captured', 128000),
('pay-HX-20371', 'HX-20371', 'captured', 384000);

INSERT INTO "payment_events" ("event_id", "payment_id", "event_type", "occurred_at") VALUES
('pay-event-HX-20491', 'pay-HX-20491', 'captured', '2026-06-14T09:12:00.000Z'),
('pay-event-HX-20472', 'pay-HX-20472', 'captured', '2026-06-13T13:34:00.000Z'),
('pay-event-HX-20388', 'pay-HX-20388', 'captured', '2026-06-11T16:22:00.000Z'),
('pay-event-HX-20371', 'pay-HX-20371', 'captured', '2026-06-10T10:01:00.000Z');

INSERT INTO "invoices" ("invoice_id", "account_id", "order_id", "issued_at", "due_at", "amount_cents", "status", "risk") VALUES
('inv-nova-2026-06', 'acct-nova', 'HX-20491', '2026-06-01T00:00:00.000Z', '2026-06-15T00:00:00.000Z', 431000, 'past_due', 'payment_hold_requested'),
('inv-helio-2026-06', 'acct-helio', 'HX-20472', '2026-06-02T00:00:00.000Z', '2026-06-30T00:00:00.000Z', 212000, 'open', NULL),
('inv-polaris-2026-06', 'acct-polaris', 'HX-20388', '2026-06-02T00:00:00.000Z', '2026-06-30T00:00:00.000Z', 74000, 'open', NULL);

INSERT INTO "invoice_line_items" ("invoice_line_id", "invoice_id", "description", "amount_cents") VALUES
('line-inv-nova-2026-06', 'inv-nova-2026-06', 'Order HX-20491', 431000),
('line-inv-helio-2026-06', 'inv-helio-2026-06', 'Order HX-20472', 212000),
('line-inv-polaris-2026-06', 'inv-polaris-2026-06', 'Order HX-20388', 74000);

INSERT INTO "payment_risk_events" ("risk_event_id", "invoice_id", "account_id", "risk_code", "created_at") VALUES
('risk-inv-nova-2026-06', 'inv-nova-2026-06', 'acct-nova', 'payment_hold_requested', '2026-06-15T00:00:00.000Z');

INSERT INTO "usage_snapshots" ("snapshot_id", "account_id", "captured_at", "active_users_7d", "active_users_previous_7d", "critical_workflows", "failed_syncs_24h", "trend") VALUES
('usage-nova-2026-06-16', 'acct-nova', '2026-06-16T08:00:00.000Z', 184, 302, 6, 17, 'down'),
('usage-helio-2026-06-16', 'acct-helio', '2026-06-16T08:00:00.000Z', 212, 205, 8, 1, 'stable'),
('usage-polaris-2026-06-16', 'acct-polaris', '2026-06-16T08:00:00.000Z', 63, 66, 2, 3, 'stable');

INSERT INTO "usage_products" ("snapshot_id", "product_family", "active_users") VALUES
('usage-nova-2026-06-16', 'operations', 184),
('usage-nova-2026-06-16', 'integration-sync', 167),
('usage-helio-2026-06-16', 'operations', 212),
('usage-helio-2026-06-16', 'integration-sync', 211),
('usage-polaris-2026-06-16', 'operations', 63),
('usage-polaris-2026-06-16', 'integration-sync', 60);

INSERT INTO "support_cases" ("case_id", "account_id", "order_id", "opened_at", "priority", "status", "summary") VALUES
('case-nova-77', 'acct-nova', 'HX-20491', '2026-06-15T14:42:00.000Z', 'high', 'open', 'Customer wants a release ETA and audit-safe status update.'),
('case-nova-81', 'acct-nova', NULL, '2026-06-16T09:20:00.000Z', 'urgent', 'open', 'CIO asked whether renewal terms can be paused until delivery is recovered.'),
('case-polaris-31', 'acct-polaris', 'HX-20388', '2026-06-14T08:10:00.000Z', 'normal', 'open', 'Carrier capacity delay needs customer-facing explanation.');

INSERT INTO "case_comments" ("comment_id", "case_id", "created_at", "body") VALUES
('comment-case-nova-77', 'case-nova-77', '2026-06-15T14:42:00.000Z', 'Customer wants a release ETA and audit-safe status update.'),
('comment-case-nova-81', 'case-nova-81', '2026-06-16T09:20:00.000Z', 'CIO asked whether renewal terms can be paused until delivery is recovered.'),
('comment-case-polaris-31', 'case-polaris-31', '2026-06-14T08:10:00.000Z', 'Carrier capacity delay needs customer-facing explanation.');

INSERT INTO "support_case_links" ("case_id", "subject_type", "subject_id") VALUES
('case-nova-77', 'order', 'HX-20491'),
('case-polaris-31', 'order', 'HX-20388');

INSERT INTO "activities" ("activity_id", "account_id", "case_id", "summary", "occurred_at") VALUES
('act-case-nova-77', 'acct-nova', 'case-nova-77', 'Customer wants a release ETA and audit-safe status update.', '2026-06-15T14:42:00.000Z'),
('act-case-nova-81', 'acct-nova', 'case-nova-81', 'CIO asked whether renewal terms can be paused until delivery is recovered.', '2026-06-16T09:20:00.000Z'),
('act-case-polaris-31', 'acct-polaris', 'case-polaris-31', 'Carrier capacity delay needs customer-facing explanation.', '2026-06-14T08:10:00.000Z');

INSERT INTO "compliance_reviews" ("review_id", "account_id", "order_id", "opened_at", "status") VALUES
('comp-nova-hx-20491', 'acct-nova', 'HX-20491', '2026-06-15T18:00:00.000Z', 'review_required'),
('comp-helio-hx-20472', 'acct-helio', 'HX-20472', '2026-06-14T11:00:00.000Z', 'cleared');

INSERT INTO "compliance_review_flags" ("review_id", "flag") VALUES
('comp-nova-hx-20491', 'regulated-shipping'),
('comp-nova-hx-20491', 'public-company-disclosure'),
('comp-nova-hx-20491', 'customs-hold'),
('comp-helio-hx-20472', 'regulated-shipping');

INSERT INTO "escalation_policies" ("policy_id", "name", "applies_to_status", "min_value_cents", "customer_visible_title", "customer_visible_status", "next_step", "customer_message") VALUES
('policy-strategic-customer-360-escalation', 'Strategic customer 360 escalation', 'delayed', 500000, 'At-risk escalation active', 'Executive escalation', 'Executive recovery plan by 16:00', 'We are coordinating executive recovery for your delayed shipment.');

INSERT INTO "escalation_policy_steps" ("policy_id", "step_order", "owner_group") VALUES
('policy-strategic-customer-360-escalation', 1, 'Customer Success'),
('policy-strategic-customer-360-escalation', 2, 'Legal'),
('policy-strategic-customer-360-escalation', 3, 'Finance'),
('policy-strategic-customer-360-escalation', 4, 'Support');

INSERT INTO "success_plan_milestones" ("milestone_id", "account_id", "due_at", "owner_group", "status") VALUES
('sp-acct-nova-renewal', 'acct-nova', '2026-07-31', 'Customer Success', 'at_risk'),
('sp-acct-helio-renewal', 'acct-helio', '2026-10-15', 'Customer Success', 'open'),
('sp-acct-polaris-renewal', 'acct-polaris', '2027-01-31', 'Customer Success', 'open'),
('sp-acct-cascade-renewal', 'acct-cascade', '2026-11-30', 'Customer Success', 'open');

INSERT INTO "renewal_events" ("renewal_event_id", "account_id", "renewal_date", "status") VALUES
('renewal-acct-nova', 'acct-nova', '2026-07-31', 'at_risk'),
('renewal-acct-helio', 'acct-helio', '2026-10-15', 'on_track'),
('renewal-acct-polaris', 'acct-polaris', '2027-01-31', 'on_track'),
('renewal-acct-cascade', 'acct-cascade', '2026-11-30', 'on_track');

INSERT INTO "order_status_history" ("history_id", "order_id", "status", "customer_visible", "occurred_at") VALUES
('hist-HX-20491-delayed', 'HX-20491', 'delayed', TRUE, '2026-06-14T09:12:00.000Z'),
('hist-HX-20472-in_fulfillment', 'HX-20472', 'in_fulfillment', TRUE, '2026-06-13T13:34:00.000Z'),
('hist-HX-20388-delayed', 'HX-20388', 'delayed', TRUE, '2026-06-11T16:22:00.000Z'),
('hist-HX-20371-delivered', 'HX-20371', 'delivered', FALSE, '2026-06-10T10:01:00.000Z');

INSERT INTO "sla_policies" ("policy_id", "account_tier", "region", "response_minutes") VALUES
('sla-strategic-na', 'strategic', 'NA', 60),
('sla-enterprise-na', 'enterprise', 'NA', 240),
('sla-enterprise-eu', 'enterprise', 'EU', 360),
('sla-growth-na', 'growth', 'NA', 720),
('sla-commercial-apac', 'commercial', 'APAC', 1440);

INSERT INTO "inventory_locations" ("location_id", "region", "label") VALUES
('loc-acct-nova', 'NA', 'Nova Retail Group primary'),
('loc-acct-helio', 'EU', 'Helio Medical Devices primary'),
('loc-acct-polaris', 'NA', 'Polaris Field Systems primary'),
('loc-acct-cascade', 'APAC', 'Cascade Outfitters primary');

INSERT INTO "inventory_reservations" ("reservation_id", "order_id", "product_id", "location_id", "quantity") VALUES
('res-HX-20491-prd-coldchain-kit', 'HX-20491', 'prd-coldchain-kit', 'loc-acct-nova', 4),
('res-HX-20491-prd-gateway-pro', 'HX-20491', 'prd-gateway-pro', 'loc-acct-nova', 3),
('res-HX-20491-prd-support-plus', 'HX-20491', 'prd-support-plus', 'loc-acct-nova', 1),
('res-HX-20472-prd-coldchain-kit', 'HX-20472', 'prd-coldchain-kit', 'loc-acct-helio', 2),
('res-HX-20472-prd-analytics', 'HX-20472', 'prd-analytics', 'loc-acct-helio', 2),
('res-HX-20388-prd-field-case', 'HX-20388', 'prd-field-case', 'loc-acct-polaris', 2),
('res-HX-20388-prd-gateway-pro', 'HX-20388', 'prd-gateway-pro', 'loc-acct-polaris', 1),
('res-HX-20371-prd-analytics', 'HX-20371', 'prd-analytics', 'loc-acct-cascade', 4);

INSERT INTO "portal_visibility_rules" ("rule_id", "status", "customer_visible", "title") VALUES
('rule-delayed', 'delayed', TRUE, 'Shipment delayed'),
('rule-escalation-active', 'customer_escalation_active', TRUE, 'At-risk escalation active');
