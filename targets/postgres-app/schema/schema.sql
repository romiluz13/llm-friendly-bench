CREATE TABLE account_tiers (
  tier_id text PRIMARY KEY,
  label text NOT NULL,
  review_minutes integer NOT NULL
);

CREATE TABLE owner_groups (
  owner_group text PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE accounts (
  account_id text PRIMARY KEY,
  tier_id text NOT NULL REFERENCES account_tiers(tier_id),
  name text NOT NULL,
  segment text NOT NULL,
  region text NOT NULL
);

CREATE TABLE contacts (
  contact_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  name text NOT NULL,
  role text NOT NULL,
  email text NOT NULL
);

CREATE TABLE contact_preferences (
  contact_id text NOT NULL REFERENCES contacts(contact_id),
  channel text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (contact_id, channel)
);

CREATE TABLE account_contracts (
  contract_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  contract_tier text NOT NULL,
  arr_cents integer NOT NULL,
  renewal_date date NOT NULL,
  executive_sponsor text NOT NULL,
  support_plan text NOT NULL,
  data_processing_addendum boolean NOT NULL
);

CREATE TABLE account_team_members (
  member_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  owner_group text NOT NULL REFERENCES owner_groups(owner_group),
  name text NOT NULL,
  role text NOT NULL
);

CREATE TABLE account_risk_flags (
  account_id text NOT NULL REFERENCES accounts(account_id),
  risk_flag text NOT NULL,
  PRIMARY KEY (account_id, risk_flag)
);

CREATE TABLE account_health_scores (
  account_id text NOT NULL REFERENCES accounts(account_id),
  score integer NOT NULL,
  trend text NOT NULL,
  summary text NOT NULL,
  captured_at timestamptz NOT NULL,
  PRIMARY KEY (account_id, captured_at)
);

CREATE TABLE account_health_factors (
  account_id text NOT NULL REFERENCES accounts(account_id),
  factor text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (account_id, factor)
);

CREATE TABLE account_notes (
  note_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  created_at timestamptz NOT NULL,
  body text NOT NULL
);

CREATE TABLE product_categories (
  category_id text PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE products (
  product_id text PRIMARY KEY,
  name text NOT NULL,
  unit_price_cents integer NOT NULL
);

CREATE TABLE product_category_memberships (
  product_id text NOT NULL REFERENCES products(product_id),
  category_id text NOT NULL REFERENCES product_categories(category_id),
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE subscriptions (
  subscription_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  contract_id text NOT NULL REFERENCES account_contracts(contract_id),
  product_family text NOT NULL,
  status text NOT NULL
);

CREATE TABLE entitlements (
  entitlement_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES subscriptions(subscription_id),
  feature text NOT NULL,
  enabled boolean NOT NULL
);

CREATE TABLE orders (
  order_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  contact_id text NOT NULL REFERENCES contacts(contact_id),
  created_at timestamptz NOT NULL,
  current_status text NOT NULL,
  value_cents integer NOT NULL,
  currency text NOT NULL
);

CREATE TABLE order_items (
  order_id text NOT NULL REFERENCES orders(order_id),
  product_id text NOT NULL REFERENCES products(product_id),
  quantity integer NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE shipments (
  shipment_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id),
  carrier text NOT NULL,
  delayed boolean NOT NULL,
  delay_reason text,
  promised_release_time timestamptz
);

CREATE TABLE shipment_events (
  event_id text PRIMARY KEY,
  shipment_id text NOT NULL REFERENCES shipments(shipment_id),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE shipment_regulatory_flags (
  shipment_id text NOT NULL REFERENCES shipments(shipment_id),
  flag text NOT NULL,
  PRIMARY KEY (shipment_id, flag)
);

CREATE TABLE payments (
  payment_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id),
  status text NOT NULL,
  amount_cents integer NOT NULL
);

CREATE TABLE payment_events (
  event_id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(payment_id),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE invoices (
  invoice_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  order_id text REFERENCES orders(order_id),
  issued_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL,
  risk text
);

CREATE TABLE invoice_line_items (
  invoice_line_id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES invoices(invoice_id),
  description text NOT NULL,
  amount_cents integer NOT NULL
);

CREATE TABLE payment_risk_events (
  risk_event_id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES invoices(invoice_id),
  account_id text NOT NULL REFERENCES accounts(account_id),
  risk_code text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE usage_snapshots (
  snapshot_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  captured_at timestamptz NOT NULL,
  active_users_7d integer NOT NULL,
  active_users_previous_7d integer NOT NULL,
  critical_workflows integer NOT NULL,
  failed_syncs_24h integer NOT NULL,
  trend text NOT NULL
);

CREATE TABLE usage_products (
  snapshot_id text NOT NULL REFERENCES usage_snapshots(snapshot_id),
  product_family text NOT NULL,
  active_users integer NOT NULL,
  PRIMARY KEY (snapshot_id, product_family)
);

CREATE TABLE support_cases (
  case_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  order_id text REFERENCES orders(order_id),
  opened_at timestamptz NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL
);

CREATE TABLE case_comments (
  comment_id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES support_cases(case_id),
  created_at timestamptz NOT NULL,
  body text NOT NULL
);

CREATE TABLE support_case_links (
  case_id text NOT NULL REFERENCES support_cases(case_id),
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  PRIMARY KEY (case_id, subject_type, subject_id)
);

CREATE TABLE activities (
  activity_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  case_id text REFERENCES support_cases(case_id),
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE activity_participants (
  activity_id text NOT NULL REFERENCES activities(activity_id),
  contact_id text NOT NULL REFERENCES contacts(contact_id),
  PRIMARY KEY (activity_id, contact_id)
);

CREATE TABLE compliance_reviews (
  review_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  order_id text REFERENCES orders(order_id),
  opened_at timestamptz NOT NULL,
  status text NOT NULL
);

CREATE TABLE compliance_review_flags (
  review_id text NOT NULL REFERENCES compliance_reviews(review_id),
  flag text NOT NULL,
  PRIMARY KEY (review_id, flag)
);

CREATE TABLE escalation_policies (
  policy_id text PRIMARY KEY,
  name text NOT NULL,
  applies_to_status text NOT NULL,
  min_value_cents integer NOT NULL,
  customer_visible_title text NOT NULL,
  customer_visible_status text NOT NULL,
  next_step text NOT NULL,
  customer_message text NOT NULL
);

CREATE TABLE escalation_policy_steps (
  policy_id text NOT NULL REFERENCES escalation_policies(policy_id),
  step_order integer NOT NULL,
  owner_group text NOT NULL REFERENCES owner_groups(owner_group),
  PRIMARY KEY (policy_id, step_order)
);

CREATE TABLE customer_escalations (
  escalation_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  order_id text NOT NULL REFERENCES orders(order_id),
  policy_id text NOT NULL REFERENCES escalation_policies(policy_id),
  status text NOT NULL,
  customer_visible_title text NOT NULL,
  customer_visible_status text NOT NULL,
  next_step text NOT NULL,
  customer_message text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE escalation_risk_factors (
  escalation_id text NOT NULL REFERENCES customer_escalations(escalation_id),
  factor_order integer NOT NULL,
  factor text NOT NULL,
  detail text NOT NULL,
  PRIMARY KEY (escalation_id, factor_order)
);

CREATE TABLE escalation_tasks (
  task_id text PRIMARY KEY,
  escalation_id text NOT NULL REFERENCES customer_escalations(escalation_id),
  account_id text NOT NULL REFERENCES accounts(account_id),
  order_id text NOT NULL REFERENCES orders(order_id),
  owner_group text NOT NULL REFERENCES owner_groups(owner_group),
  title text NOT NULL,
  status text NOT NULL,
  due_at timestamptz NOT NULL
);

CREATE TABLE escalation_task_assignments (
  task_id text NOT NULL REFERENCES escalation_tasks(task_id),
  owner_group text NOT NULL REFERENCES owner_groups(owner_group),
  assignee_name text NOT NULL,
  PRIMARY KEY (task_id, owner_group)
);

CREATE TABLE customer_portal_messages (
  message_id text PRIMARY KEY,
  escalation_id text NOT NULL REFERENCES customer_escalations(escalation_id),
  account_id text NOT NULL REFERENCES accounts(account_id),
  order_id text NOT NULL REFERENCES orders(order_id),
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE executive_notifications (
  notification_id text PRIMARY KEY,
  escalation_id text NOT NULL REFERENCES customer_escalations(escalation_id),
  owner_group text NOT NULL REFERENCES owner_groups(owner_group),
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE legal_review_requests (
  request_id text PRIMARY KEY,
  escalation_id text NOT NULL REFERENCES customer_escalations(escalation_id),
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE finance_review_requests (
  request_id text PRIMARY KEY,
  escalation_id text NOT NULL REFERENCES customer_escalations(escalation_id),
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE success_plan_milestones (
  milestone_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  due_at date NOT NULL,
  owner_group text NOT NULL REFERENCES owner_groups(owner_group),
  status text NOT NULL
);

CREATE TABLE renewal_events (
  renewal_event_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  renewal_date date NOT NULL,
  status text NOT NULL
);

CREATE TABLE order_status_history (
  history_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id),
  status text NOT NULL,
  customer_visible boolean NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE audit_events (
  audit_id text PRIMARY KEY,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  occurred_at timestamptz NOT NULL,
  customer_visible boolean NOT NULL
);

CREATE TABLE audit_subjects (
  audit_id text NOT NULL REFERENCES audit_events(audit_id),
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  PRIMARY KEY (audit_id, subject_type, subject_id)
);

CREATE TABLE sla_policies (
  policy_id text PRIMARY KEY,
  account_tier text NOT NULL,
  region text NOT NULL,
  response_minutes integer NOT NULL
);

CREATE TABLE sla_timers (
  timer_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id),
  policy_id text NOT NULL REFERENCES sla_policies(policy_id),
  due_at timestamptz NOT NULL
);

CREATE TABLE inventory_locations (
  location_id text PRIMARY KEY,
  region text NOT NULL,
  label text NOT NULL
);

CREATE TABLE inventory_reservations (
  reservation_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id),
  product_id text NOT NULL REFERENCES products(product_id),
  location_id text NOT NULL REFERENCES inventory_locations(location_id),
  quantity integer NOT NULL
);

CREATE TABLE portal_visibility_rules (
  rule_id text PRIMARY KEY,
  status text NOT NULL,
  customer_visible boolean NOT NULL,
  title text NOT NULL
);

CREATE TABLE notification_outbox (
  notification_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(account_id),
  contact_id text REFERENCES contacts(contact_id),
  channel text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
