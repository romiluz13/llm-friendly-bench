// Enterprise workspace generator for Build-Bench.
// Generates a REAL enterprise codebase with INLINE schema (no generator calls).
// The agent must read 400-800 lines of schema code plus 5 model files.
//
// 40 entities across 6 domains:
//   Accounts (8), Orders (10), Financial (7), Support (5), Products (5), Compliance (5)
// MongoDB: 21 collections with embedded arrays.
// Postgres-norm: 40 tables with 3NF normalization, FKs, CHECK constraints.
// Postgres-jsonb: 21 tables with JSONB doc columns + GIN indexes.
import { mkdirSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Entity Definitions ───────────────────────────────────────────────────
const ENTITIES = {
	accounts: {
		fields: {
			accountId: { type: "string", pk: true },
			name: { type: "string", required: true },
			tier: {
				type: "enum",
				values: ["strategic", "enterprise", "midmarket", "standard"],
				required: true,
			},
			segment: { type: "string" },
			region: { type: "string" },
			status: {
				type: "enum",
				values: ["active", "at-risk", "churned", "prospect"],
				required: true,
			},
			createdAt: { type: "date", required: true },
		},
	},
	account_details: {
		fields: {
			detailId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			industry: { type: "string" },
			size: {
				type: "enum",
				values: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
			},
			website: { type: "string" },
			description: { type: "string" },
			foundedYear: { type: "int" },
			headquarters: { type: "string" },
		},
	},
	account_settings: {
		fields: {
			settingId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			preferredLocale: { type: "string" },
			timezone: { type: "string" },
			dateFormat: { type: "string" },
			currencyCode: { type: "string" },
			notifyOnOrderChange: { type: "boolean" },
			notifyOnInvoiceOverdue: { type: "boolean" },
			autoApproveOrders: { type: "boolean" },
		},
	},
	account_preferences: {
		fields: {
			preferenceId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			preferredContactMethod: {
				type: "enum",
				values: ["email", "phone", "portal"],
			},
			preferredPaymentMethod: {
				type: "enum",
				values: ["card", "bank_transfer", "check", "wire"],
			},
			billingCycle: {
				type: "enum",
				values: ["monthly", "quarterly", "annual"],
			},
			renewalReminderDays: { type: "int" },
		},
	},
	account_team: {
		fields: {
			teamMemberId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			userId: { type: "string", required: true },
			role: {
				type: "enum",
				values: ["owner", "admin", "billing", "technical", "viewer"],
				required: true,
			},
			invitedAt: { type: "date" },
			joinedAt: { type: "date" },
			status: { type: "enum", values: ["active", "invited", "removed"] },
		},
	},
	account_billing: {
		fields: {
			billingId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			billingAddressLine1: { type: "string" },
			billingAddressLine2: { type: "string" },
			billingCity: { type: "string" },
			billingState: { type: "string" },
			billingPostalCode: { type: "string" },
			billingCountry: { type: "string" },
			taxId: { type: "string" },
		},
	},
	account_contracts: {
		fields: {
			contractId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			contractType: {
				type: "enum",
				values: ["standard", "enterprise", "custom"],
				required: true,
			},
			startDate: { type: "date", required: true },
			endDate: { type: "date" },
			arrCents: { type: "int", required: true },
			status: {
				type: "enum",
				values: ["active", "expired", "pending", "terminated"],
				required: true,
			},
			autoRenew: { type: "boolean" },
			negotiatedDiscountPct: { type: "decimal" },
		},
	},
	account_health_scores: {
		fields: {
			scoreId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			score: { type: "int", required: true },
			trend: { type: "enum", values: ["improving", "stable", "declining"] },
			calculatedAt: { type: "date", required: true },
			riskLevel: {
				type: "enum",
				values: ["low", "medium", "high", "critical"],
			},
			notes: { type: "string" },
		},
	},
	orders: {
		fields: {
			orderId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			contactId: { type: "string" },
			status: {
				type: "enum",
				values: [
					"draft",
					"pending",
					"approved",
					"fulfilled",
					"cancelled",
					"returned",
				],
				required: true,
			},
			totalCents: { type: "int", required: true },
			currency: { type: "string", required: true },
			createdAt: { type: "date", required: true },
			approvedAt: { type: "date" },
			fulfilledAt: { type: "date" },
			notes: { type: "string" },
		},
	},
	order_line_items: {
		fields: {
			lineItemId: { type: "string", pk: true },
			orderId: { type: "string", fk: "orders", required: true },
			productId: { type: "string", fk: "products", required: true },
			productName: { type: "string", required: true },
			quantity: { type: "int", required: true },
			unitPriceCents: { type: "int", required: true },
			discountCents: { type: "int" },
			taxCents: { type: "int" },
			totalCents: { type: "int", required: true },
		},
	},
	order_fulfillments: {
		fields: {
			fulfillmentId: { type: "string", pk: true },
			orderId: { type: "string", fk: "orders", required: true },
			status: {
				type: "enum",
				values: ["pending", "processing", "shipped", "delivered", "failed"],
				required: true,
			},
			fulfilledAt: { type: "date" },
			warehouseId: { type: "string" },
			carrierId: { type: "string" },
			notes: { type: "string" },
		},
	},
	order_returns: {
		fields: {
			returnId: { type: "string", pk: true },
			orderId: { type: "string", fk: "orders", required: true },
			reason: {
				type: "enum",
				values: ["defective", "wrong_item", "cancelled", "other"],
				required: true,
			},
			status: {
				type: "enum",
				values: ["requested", "approved", "processed", "denied"],
				required: true,
			},
			refundCents: { type: "int" },
			requestedAt: { type: "date", required: true },
			processedAt: { type: "date" },
		},
	},
	shipments: {
		fields: {
			shipmentId: { type: "string", pk: true },
			orderId: { type: "string", fk: "orders", required: true },
			carrier: { type: "string", required: true },
			trackingNumber: { type: "string" },
			status: {
				type: "enum",
				values: ["pending", "in_transit", "delivered", "returned", "lost"],
				required: true,
			},
			shippedAt: { type: "date" },
			deliveredAt: { type: "date" },
			shippingCostCents: { type: "int" },
			originAddress: { type: "string" },
			destinationAddress: { type: "string" },
		},
	},
	shipment_items: {
		fields: {
			shipmentItemId: { type: "string", pk: true },
			shipmentId: { type: "string", fk: "shipments", required: true },
			lineItemId: { type: "string", fk: "order_line_items", required: true },
			quantityShipped: { type: "int", required: true },
		},
	},
	shipment_tracking: {
		fields: {
			trackingEventId: { type: "string", pk: true },
			shipmentId: { type: "string", fk: "shipments", required: true },
			event: {
				type: "enum",
				values: [
					"picked_up",
					"in_transit",
					"out_for_delivery",
					"delivered",
					"exception",
				],
				required: true,
			},
			location: { type: "string" },
			timestamp: { type: "date", required: true },
			description: { type: "string" },
		},
	},
	delivery_confirmations: {
		fields: {
			confirmationId: { type: "string", pk: true },
			shipmentId: { type: "string", fk: "shipments", required: true },
			confirmedBy: { type: "string", required: true },
			confirmedAt: { type: "date", required: true },
			signatureRequired: { type: "boolean" },
			photoUrl: { type: "string" },
			notes: { type: "string" },
		},
	},
	order_status_history: {
		fields: {
			historyId: { type: "string", pk: true },
			orderId: { type: "string", fk: "orders", required: true },
			fromStatus: { type: "string" },
			toStatus: { type: "string", required: true },
			changedBy: { type: "string", required: true },
			changedAt: { type: "date", required: true },
			reason: { type: "string" },
		},
	},
	order_approvals: {
		fields: {
			approvalId: { type: "string", pk: true },
			orderId: { type: "string", fk: "orders", required: true },
			approverId: { type: "string", required: true },
			status: {
				type: "enum",
				values: ["pending", "approved", "rejected"],
				required: true,
			},
			approverRole: { type: "string" },
			approvedAt: { type: "date" },
			comments: { type: "string" },
		},
	},
	invoices: {
		fields: {
			invoiceId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			orderId: { type: "string", fk: "orders" },
			invoiceNumber: { type: "string", required: true },
			amountCents: { type: "int", required: true },
			taxCents: { type: "int" },
			totalCents: { type: "int", required: true },
			status: {
				type: "enum",
				values: ["draft", "sent", "paid", "overdue", "void"],
				required: true,
			},
			issuedAt: { type: "date", required: true },
			dueAt: { type: "date", required: true },
			paidAt: { type: "date" },
		},
	},
	invoice_line_items: {
		fields: {
			invoiceLineItemId: { type: "string", pk: true },
			invoiceId: { type: "string", fk: "invoices", required: true },
			description: { type: "string", required: true },
			quantity: { type: "int", required: true },
			unitPriceCents: { type: "int", required: true },
			totalCents: { type: "int", required: true },
			taxRatePct: { type: "decimal" },
		},
	},
	payments: {
		fields: {
			paymentId: { type: "string", pk: true },
			invoiceId: { type: "string", fk: "invoices", required: true },
			accountId: { type: "string", fk: "accounts", required: true },
			amountCents: { type: "int", required: true },
			method: {
				type: "enum",
				values: ["card", "bank_transfer", "wire", "check", "cash"],
				required: true,
			},
			status: {
				type: "enum",
				values: ["pending", "completed", "failed", "refunded"],
				required: true,
			},
			processedAt: { type: "date", required: true },
			reference: { type: "string" },
		},
	},
	payment_methods: {
		fields: {
			paymentMethodId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			type: {
				type: "enum",
				values: ["card", "bank_account", "wire"],
				required: true,
			},
			last4: { type: "string" },
			expiryMonth: { type: "int" },
			expiryYear: { type: "int" },
			isDefault: { type: "boolean" },
			billingAddress: { type: "string" },
		},
	},
	credit_notes: {
		fields: {
			creditNoteId: { type: "string", pk: true },
			invoiceId: { type: "string", fk: "invoices", required: true },
			accountId: { type: "string", fk: "accounts", required: true },
			amountCents: { type: "int", required: true },
			reason: { type: "string", required: true },
			status: {
				type: "enum",
				values: ["draft", "issued", "applied", "void"],
				required: true,
			},
			issuedAt: { type: "date", required: true },
		},
	},
	tax_records: {
		fields: {
			taxRecordId: { type: "string", pk: true },
			invoiceId: { type: "string", fk: "invoices", required: true },
			taxType: { type: "string", required: true },
			jurisdiction: { type: "string", required: true },
			ratePct: { type: "decimal", required: true },
			amountCents: { type: "int", required: true },
		},
	},
	billing_cycles: {
		fields: {
			billingCycleId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			period: {
				type: "enum",
				values: ["monthly", "quarterly", "annual"],
				required: true,
			},
			startDate: { type: "date", required: true },
			endDate: { type: "date", required: true },
			status: {
				type: "enum",
				values: ["active", "closed", "pending"],
				required: true,
			},
			totalBilledCents: { type: "int" },
		},
	},
	support_cases: {
		fields: {
			caseId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			subject: { type: "string", required: true },
			priority: {
				type: "enum",
				values: ["low", "medium", "high", "urgent"],
				required: true,
			},
			status: {
				type: "enum",
				values: ["open", "in_progress", "resolved", "closed", "escalated"],
				required: true,
			},
			openedAt: { type: "date", required: true },
			resolvedAt: { type: "date" },
			assignedTo: { type: "string" },
		},
	},
	case_comments: {
		fields: {
			commentId: { type: "string", pk: true },
			caseId: { type: "string", fk: "support_cases", required: true },
			authorId: { type: "string", required: true },
			body: { type: "string", required: true },
			createdAt: { type: "date", required: true },
			isInternal: { type: "boolean" },
		},
	},
	case_escalations: {
		fields: {
			escalationId: { type: "string", pk: true },
			caseId: { type: "string", fk: "support_cases", required: true },
			escalatedBy: { type: "string", required: true },
			escalatedTo: { type: "string", required: true },
			reason: { type: "string", required: true },
			status: {
				type: "enum",
				values: ["active", "resolved", "cancelled"],
				required: true,
			},
			createdAt: { type: "date", required: true },
		},
	},
	sla_policies: {
		fields: {
			slaPolicyId: { type: "string", pk: true },
			name: { type: "string", required: true },
			priorityLevel: {
				type: "enum",
				values: ["low", "medium", "high", "urgent"],
				required: true,
			},
			responseTimeHours: { type: "int", required: true },
			resolutionTimeHours: { type: "int", required: true },
		},
	},
	support_assignments: {
		fields: {
			assignmentId: { type: "string", pk: true },
			caseId: { type: "string", fk: "support_cases", required: true },
			agentId: { type: "string", required: true },
			role: {
				type: "enum",
				values: ["primary", "secondary", "observer"],
				required: true,
			},
			assignedAt: { type: "date", required: true },
		},
	},
	products: {
		fields: {
			productId: { type: "string", pk: true },
			name: { type: "string", required: true },
			sku: { type: "string", required: true },
			categoryId: { type: "string", fk: "product_categories" },
			description: { type: "string" },
			isActive: { type: "boolean" },
			launchedAt: { type: "date" },
		},
	},
	product_categories: {
		fields: {
			categoryId: { type: "string", pk: true },
			name: { type: "string", required: true },
			parentId: { type: "string", fk: "product_categories" },
			description: { type: "string" },
		},
	},
	product_pricing: {
		fields: {
			pricingId: { type: "string", pk: true },
			productId: { type: "string", fk: "products", required: true },
			tier: {
				type: "enum",
				values: ["standard", "volume", "enterprise"],
				required: true,
			},
			unitPriceCents: { type: "int", required: true },
			currency: { type: "string", required: true },
			effectiveFrom: { type: "date", required: true },
			effectiveTo: { type: "date" },
			minQuantity: { type: "int" },
		},
	},
	product_inventory: {
		fields: {
			inventoryId: { type: "string", pk: true },
			productId: { type: "string", fk: "products", required: true },
			warehouseId: { type: "string", required: true },
			quantityOnHand: { type: "int", required: true },
			quantityReserved: { type: "int" },
			reorderThreshold: { type: "int" },
			lastCountedAt: { type: "date" },
		},
	},
	product_reviews: {
		fields: {
			reviewId: { type: "string", pk: true },
			productId: { type: "string", fk: "products", required: true },
			accountId: { type: "string", fk: "accounts" },
			rating: { type: "int", required: true },
			title: { type: "string" },
			body: { type: "string" },
			createdAt: { type: "date", required: true },
			verified: { type: "boolean" },
		},
	},
	compliance_reviews: {
		fields: {
			reviewId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			reviewType: {
				type: "enum",
				values: [
					"data_audit",
					"security_audit",
					"privacy_assessment",
					"regulatory_check",
				],
				required: true,
			},
			status: {
				type: "enum",
				values: ["open", "in_progress", "passed", "failed"],
				required: true,
			},
			openedAt: { type: "date", required: true },
			closedAt: { type: "date" },
			reviewer: { type: "string" },
		},
	},
	regulatory_flags: {
		fields: {
			flagId: { type: "string", pk: true },
			reviewId: { type: "string", fk: "compliance_reviews", required: true },
			regulation: {
				type: "enum",
				values: ["gdpr", "ccpa", "hipaa", "sox", "export_control"],
				required: true,
			},
			severity: {
				type: "enum",
				values: ["info", "warning", "critical"],
				required: true,
			},
			description: { type: "string", required: true },
			raisedAt: { type: "date", required: true },
			resolvedAt: { type: "date" },
		},
	},
	audit_trails: {
		fields: {
			auditId: { type: "string", pk: true },
			entityType: { type: "string", required: true },
			entityId: { type: "string", required: true },
			action: { type: "string", required: true },
			performedBy: { type: "string", required: true },
			performedAt: { type: "date", required: true },
			oldValue: { type: "string" },
			newValue: { type: "string" },
		},
	},
	data_processing_agreements: {
		fields: {
			dpaId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			version: { type: "string", required: true },
			status: {
				type: "enum",
				values: ["active", "expired", "terminated", "pending"],
				required: true,
			},
			signedAt: { type: "date" },
			expiresAt: { type: "date" },
		},
	},
	consent_records: {
		fields: {
			consentId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			consentType: { type: "string", required: true },
			granted: { type: "boolean", required: true },
			grantedAt: { type: "date" },
			revokedAt: { type: "date" },
			scope: { type: "string" },
		},
	},
};

// Entities embedded as arrays in parent collections (MongoDB)
const EMBED_MAP = {
	orders: ["order_line_items", "order_status_history", "order_approvals"],
	shipments: ["shipment_items", "shipment_tracking", "delivery_confirmations"],
	support_cases: ["case_comments", "case_escalations", "support_assignments"],
	invoices: ["invoice_line_items"],
	products: ["product_reviews", "product_pricing"],
	accounts: [
		"account_details",
		"account_settings",
		"account_preferences",
		"account_team",
		"account_billing",
		"account_health_scores",
	],
	compliance_reviews: ["regulatory_flags"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function toSnakeCase(s) {
	return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function getStandaloneEntities() {
	const embedded = new Set();
	for (const children of Object.values(EMBED_MAP)) {
		for (const child of children) embedded.add(child);
	}
	return Object.keys(ENTITIES).filter((name) => !embedded.has(name));
}

// ─── Mongo Schema (inline) ────────────────────────────────────────────────
function mongoBsonType(fieldDef) {
	if (fieldDef.type === "string") return "string";
	if (fieldDef.type === "int") return "int";
	if (fieldDef.type === "decimal") return "double";
	if (fieldDef.type === "boolean") return "bool";
	if (fieldDef.type === "date") return "date";
	if (fieldDef.type === "enum") return "string";
	return "string";
}

function generateMongoSchemaCode() {
	const standalone = getStandaloneEntities();
	let code = `import { withDb } from "./db.mjs";

// Enterprise schema — 21 collections with embedded arrays.
// This file contains the FULL schema inline. Read it to understand the data model.
// The schema covers 6 domains: Accounts, Orders, Financial, Support, Products, Compliance.

export const preferredPaymentMethods = [];

export async function ensureSchema(db) {
`;

	for (const collName of standalone) {
		const entity = ENTITIES[collName];
		const children = EMBED_MAP[collName] || [];
		code += `\t// ─── ${collName} ──────────────────────────────────────\n`;
		code += `\tawait db.createCollection("${collName}", {\n`;
		code += `\t\tvalidator: { $jsonSchema: {\n`;
		code += `\t\t\tbsonType: "object",\n`;
		code += `\t\t\trequired: [${Object.entries(entity.fields)
			.filter(([k, v]) => v.required)
			.map(([k]) => `"${k}"`)
			.join(", ")}],\n`;
		code += `\t\t\tproperties: {\n`;
		for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
			const bsType = mongoBsonType(fieldDef);
			if (fieldDef.type === "enum") {
				code += `\t\t\t\t${fieldName}: { bsonType: "${bsType}", enum: [${fieldDef.values.map((v) => `"${v}"`).join(", ")}] },\n`;
			} else if (fieldDef.pk) {
				code += `\t\t\t\t${fieldName}: { bsonType: "${bsType}" },\n`;
			} else {
				code += `\t\t\t\t${fieldName}: { bsonType: "${bsType}" },\n`;
			}
		}
		// Add embedded child arrays
		for (const childName of children) {
			const childEntity = ENTITIES[childName];
			code += `\t\t\t\t${childName}: {\n`;
			code += `\t\t\t\t\tbsonType: "array",\n`;
			code += `\t\t\t\t\titems: {\n`;
			code += `\t\t\t\t\t\tbsonType: "object",\n`;
			code += `\t\t\t\t\t\trequired: [${Object.entries(childEntity.fields)
				.filter(([k, v]) => v.required)
				.map(([k]) => `"${k}"`)
				.join(", ")}],\n`;
			code += `\t\t\t\t\t\tproperties: {\n`;
			for (const [cf, cd] of Object.entries(childEntity.fields)) {
				const bsType = mongoBsonType(cd);
				if (cd.type === "enum") {
					code += `\t\t\t\t\t\t\t${cf}: { bsonType: "${bsType}", enum: [${cd.values.map((v) => `"${v}"`).join(", ")}] },\n`;
				} else {
					code += `\t\t\t\t\t\t\t${cf}: { bsonType: "${bsType}" },\n`;
				}
			}
			code += `\t\t\t\t\t\t}\n`;
			code += `\t\t\t\t\t}\n`;
			code += `\t\t\t\t},\n`;
		}
		code += `\t\t\t}\n`;
		code += `\t\t} }\n`;
		code += `\t});\n`;
		// Add index on FK if present
		for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
			if (fieldDef.fk) {
				code += `\tawait db.collection("${collName}").createIndex({ ${fieldName}: 1 });\n`;
			}
		}
		code += `\n`;
	}

	code += `}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
\twithDb((db) => ensureSchema(db)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	return code;
}

// ─── Postgres Normalized Schema (inline) ──────────────────────────────────
function pgColumnType(fieldDef) {
	if (fieldDef.type === "string") return "TEXT";
	if (fieldDef.type === "int") return "INTEGER";
	if (fieldDef.type === "decimal") return "NUMERIC(12,2)";
	if (fieldDef.type === "boolean") return "BOOLEAN";
	if (fieldDef.type === "date") return "TIMESTAMPTZ";
	if (fieldDef.type === "enum") return "TEXT";
	return "TEXT";
}

function generatePgNormSchemaCode() {
	// Sort entities by dependency order (tables with no FKs first, then tables that reference them)
	const sorted = topoSortEntities();
	let code = `import { withDb } from "./db.mjs";

// Enterprise schema — 40 tables with 3NF normalization, FKs, CHECK constraints.
// This file contains the FULL schema inline. Read it to understand the data model.
// The schema covers 6 domains: Accounts, Orders, Financial, Support, Products, Compliance.

export const preferredPaymentMethods = [];

export async function ensureSchema(client) {
`;

	for (const tableName of sorted) {
		const entity = ENTITIES[tableName];
		code += `\t// ─── ${tableName} ──────────────────────────────────────\n`;
		code += `\tawait client.query(\`\n`;
		code += `\t\tCREATE TABLE IF NOT EXISTS ${tableName} (\n`;
		const colLines = [];
		for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
			const colName = toSnakeCase(fieldName);
			let line = `\t\t\t${colName} ${pgColumnType(fieldDef)}`;
			if (fieldDef.pk) line += " PRIMARY KEY";
			if (fieldDef.required && !fieldDef.pk) line += " NOT NULL";
			if (fieldDef.type === "enum") {
				const constraintName = `chk_${tableName}_${colName}`;
				line += `,\n\t\t\tCONSTRAINT ${constraintName} CHECK (${colName} IN (${fieldDef.values.map((v) => `'${v}'`).join(", ")}))`;
			}
			colLines.push(line);
		}
		// Add FK constraints
		for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
			if (fieldDef.fk) {
				const colName = toSnakeCase(fieldName);
				const refCol = Object.entries(ENTITIES[fieldDef.fk].fields).find(
					([k, v]) => v.pk,
				);
				const refColName = refCol ? toSnakeCase(refCol[0]) : "id";
				colLines.push(
					`\t\t\tFOREIGN KEY (${colName}) REFERENCES ${fieldDef.fk}(${refColName})`,
				);
			}
		}
		code += colLines.join(",\n") + "\n";
		code += `\t)\`);\n`;
		// Add index on FK columns
		for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
			if (fieldDef.fk) {
				const colName = toSnakeCase(fieldName);
				code += `\tawait client.query(\`CREATE INDEX IF NOT EXISTS idx_${tableName}_${colName} ON ${tableName} (${colName})\`);\n`;
			}
		}
		code += `\n`;
	}

	code += `}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
\twithDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	return code;
}

// ─── Postgres JSONB Schema (inline) ───────────────────────────────────────
function generatePgJsonbSchemaCode() {
	const standalone = getStandaloneEntities();
	let code = `import { withDb } from "./db.mjs";

// Enterprise schema — 21 tables with JSONB doc columns + GIN indexes.
// This file contains the FULL schema inline. Read it to understand the data model.
// The schema covers 6 domains: Accounts, Orders, Financial, Support, Products, Compliance.

export const preferredPaymentMethods = [];

export async function ensureSchema(client) {
`;

	for (const tableName of standalone) {
		const entity = ENTITIES[tableName];
		const children = EMBED_MAP[tableName] || [];
		// Find the PK field
		const pkField = Object.entries(entity.fields).find(([k, v]) => v.pk);
		const pkName = pkField ? pkField[0] : "id";
		const pkSnake = toSnakeCase(pkName);
		// Find FK fields for top-level columns
		const fkFields = Object.entries(entity.fields).filter(([k, v]) => v.fk);

		code += `\t// ─── ${tableName} ──────────────────────────────────────\n`;
		code += `\tawait client.query(\`\n`;
		code += `\t\tCREATE TABLE IF NOT EXISTS ${tableName} (\n`;
		code += `\t\t\t${pkSnake} TEXT PRIMARY KEY,\n`;
		for (const [fieldName, fieldDef] of fkFields) {
			const colName = toSnakeCase(fieldName);
			code += `\t\t\t${colName} TEXT,\n`;
		}
		code += `\t\t\tdoc JSONB NOT NULL,\n`;
		// Add FK constraints
		for (const [fieldName, fieldDef] of fkFields) {
			const colName = toSnakeCase(fieldName);
			const refCol = Object.entries(ENTITIES[fieldDef.fk].fields).find(
				([k, v]) => v.pk,
			);
			const refColName = refCol ? toSnakeCase(refCol[0]) : "id";
			code += `\t\t\tFOREIGN KEY (${colName}) REFERENCES ${fieldDef.fk}(${refColName}),\n`;
		}
		code += `\t\t\tCONSTRAINT chk_${tableName}_doc CHECK (doc IS NOT NULL)\n`;
		code += `\t)\`);\n`;
		code += `\tawait client.query(\`CREATE INDEX IF NOT EXISTS idx_${tableName}_doc ON ${tableName} USING GIN (doc jsonb_path_ops)\`);\n`;
		for (const [fieldName, fieldDef] of fkFields) {
			const colName = toSnakeCase(fieldName);
			code += `\tawait client.query(\`CREATE INDEX IF NOT EXISTS idx_${tableName}_${colName} ON ${tableName} (${colName})\`);\n`;
		}
		code += `\n`;
	}

	code += `}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
\twithDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	return code;
}

// ─── Topological sort for PG table creation order ─────────────────────────
function topoSortEntities() {
	const sorted = [];
	const visited = new Set();
	function visit(name) {
		if (visited.has(name)) return;
		visited.add(name);
		const entity = ENTITIES[name];
		for (const [_, fieldDef] of Object.entries(entity.fields)) {
			if (fieldDef.fk && !visited.has(fieldDef.fk)) {
				visit(fieldDef.fk);
			}
		}
		sorted.push(name);
	}
	for (const name of Object.keys(ENTITIES)) {
		visit(name);
	}
	return sorted;
}

// ─── Model Files ──────────────────────────────────────────────────────────
function generateAccountsModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema, preferredPaymentMethods } from "./schema.mjs";

// Account model — CRUD for the accounts collection.
// The accounts entity has: accountId, name, tier, segment, region, status, createdAt.
// It also has embedded arrays: account_details, account_settings, account_preferences,
// account_team, account_billing, account_health_scores.

export async function createAccount(db, data) {
\tawait ensureSchema(db);
\tconst result = await db.collection("accounts").insertOne(data);
\treturn { _id: result.insertedId, ...data };
}

export async function getAccount(db, accountId) {
\treturn db.collection("accounts").findOne({ accountId });
}

export async function updateAccount(db, accountId, data) {
\tawait db.collection("accounts").updateOne({ accountId }, { $set: data });
\treturn db.collection("accounts").findOne({ accountId });
}

export async function deleteAccount(db, accountId) {
\tawait db.collection("accounts").deleteOne({ accountId });
}

export async function listAccounts(db, filter = {}) {
\treturn db.collection("accounts").find(filter).toArray();
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema, preferredPaymentMethods } from "./schema.mjs";

// Account model — CRUD for the accounts table.
// The accounts entity has: accountId, name, tier, segment, region, status, createdAt.
// Related tables: account_details, account_settings, account_preferences,
// account_team, account_billing, account_contracts, account_health_scores.

function rowToAccount(r) {
\tif (!r) return null;
\treturn { accountId: r.account_id, name: r.name, tier: r.tier, segment: r.segment, region: r.region, status: r.status, createdAt: r.created_at };
}

export async function createAccount(client, data) {
\tawait ensureSchema(client);
\tconst res = await client.query(
\t\t'INSERT INTO accounts (account_id, name, tier, segment, region, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
\t\t[data.accountId, data.name, data.tier, data.segment || null, data.region || null, data.status, data.createdAt || new Date()]
\t);
\treturn rowToAccount(res.rows[0]);
}

export async function getAccount(client, accountId) {
\tconst res = await client.query('SELECT * FROM accounts WHERE account_id = $1', [accountId]);
\treturn rowToAccount(res.rows[0]);
}

export async function updateAccount(client, accountId, data) {
\tconst sets = [], vals = [];
\tlet i = 1;
\tif (data.name !== undefined) { sets.push(\`name = $\${i++}\`); vals.push(data.name); }
\tif (data.tier !== undefined) { sets.push(\`tier = $\${i++}\`); vals.push(data.tier); }
\tif (data.segment !== undefined) { sets.push(\`segment = $\${i++}\`); vals.push(data.segment); }
\tif (data.region !== undefined) { sets.push(\`region = $\${i++}\`); vals.push(data.region); }
\tif (data.status !== undefined) { sets.push(\`status = $\${i++}\`); vals.push(data.status); }
\tif (sets.length === 0) return getAccount(client, accountId);
\tvals.push(accountId);
\tawait client.query(\`UPDATE accounts SET \${sets.join(', ')} WHERE account_id = $\${i}\`, vals);
\tconst res = await client.query('SELECT * FROM accounts WHERE account_id = $1', [accountId]);
\treturn rowToAccount(res.rows[0]);
}

export async function deleteAccount(client, accountId) {
\tawait client.query('DELETE FROM accounts WHERE account_id = $1', [accountId]);
}

export async function listAccounts(client, filter = {}) {
\tconst res = await client.query('SELECT * FROM accounts LIMIT 100');
\treturn res.rows.map(rowToAccount);
}
`;
	}
	// postgres-jsonb
	return `import { ensureSchema, preferredPaymentMethods } from "./schema.mjs";

// Account model — CRUD for the accounts table (JSONB doc column).
// The accounts entity stores all fields in a JSONB doc: accountId, name, tier,
// segment, region, status, createdAt, plus embedded arrays for details, settings,
// preferences, team, billing, health_scores.

export async function createAccount(client, data) {
\tawait ensureSchema(client);
\tconst doc = { ...data };
\tawait client.query(
\t\t'INSERT INTO accounts (account_id, doc) VALUES ($1, $2) RETURNING doc',
\t\t[doc.accountId, JSON.stringify(doc)]
\t);
\treturn doc;
}

export async function getAccount(client, accountId) {
\tconst res = await client.query('SELECT doc FROM accounts WHERE account_id = $1', [accountId]);
\treturn res.rows[0]?.doc || null;
}

export async function updateAccount(client, accountId, data) {
\tconst existing = await getAccount(client, accountId);
\tif (!existing) return null;
\tconst updated = { ...existing, ...data };
\tawait client.query('UPDATE accounts SET doc = $1 WHERE account_id = $2', [JSON.stringify(updated), accountId]);
\treturn updated;
}

export async function deleteAccount(client, accountId) {
\tawait client.query('DELETE FROM accounts WHERE account_id = $1', [accountId]);
}

export async function listAccounts(client, filter = {}) {
\tconst res = await client.query('SELECT doc FROM accounts LIMIT 100');
\treturn res.rows.map(r => r.doc);
}
`;
}

function generateOrdersModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

// Order model — CRUD for the orders collection.
// Orders embed: order_line_items, order_status_history, order_approvals as arrays.
// References accounts via accountId.

export async function createOrder(db, data) {
\tawait ensureSchema(db);
\tconst result = await db.collection("orders").insertOne(data);
\treturn { _id: result.insertedId, ...data };
}

export async function getOrder(db, orderId) {
\treturn db.collection("orders").findOne({ orderId });
}

export async function updateOrder(db, orderId, data) {
\tawait db.collection("orders").updateOne({ orderId }, { $set: data });
\treturn db.collection("orders").findOne({ orderId });
}

export async function listOrdersByAccount(db, accountId) {
\treturn db.collection("orders").find({ accountId }).toArray();
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

// Order model — CRUD for the orders table.
// Related tables: order_line_items, order_fulfillments, order_returns,
// order_status_history, order_approvals, shipments.
// References accounts via account_id FK.

function rowToOrder(r) {
\tif (!r) return null;
\treturn { orderId: r.order_id, accountId: r.account_id, contactId: r.contact_id, status: r.status, totalCents: r.total_cents, currency: r.currency, createdAt: r.created_at, approvedAt: r.approved_at, fulfilledAt: r.fulfilled_at, notes: r.notes };
}

export async function createOrder(client, data) {
\tawait ensureSchema(client);
\tconst res = await client.query(
\t\t'INSERT INTO orders (order_id, account_id, contact_id, status, total_cents, currency, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
\t\t[data.orderId, data.accountId, data.contactId || null, data.status, data.totalCents, data.currency, data.createdAt || new Date()]
\t);
\treturn rowToOrder(res.rows[0]);
}

export async function getOrder(client, orderId) {
\tconst res = await client.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
\treturn rowToOrder(res.rows[0]);
}

export async function updateOrder(client, orderId, data) {
\tconst sets = [], vals = [];
\tlet i = 1;
\tif (data.status !== undefined) { sets.push(\`status = $\${i++}\`); vals.push(data.status); }
\tif (data.totalCents !== undefined) { sets.push(\`total_cents = $\${i++}\`); vals.push(data.totalCents); }
\tif (data.approvedAt !== undefined) { sets.push(\`approved_at = $\${i++}\`); vals.push(data.approvedAt); }
\tif (data.fulfilledAt !== undefined) { sets.push(\`fulfilled_at = $\${i++}\`); vals.push(data.fulfilledAt); }
\tif (sets.length === 0) return getOrder(client, orderId);
\tvals.push(orderId);
\tawait client.query(\`UPDATE orders SET \${sets.join(', ')} WHERE order_id = $\${i}\`, vals);
\tconst res = await client.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
\treturn rowToOrder(res.rows[0]);
}

export async function listOrdersByAccount(client, accountId) {
\tconst res = await client.query('SELECT * FROM orders WHERE account_id = $1', [accountId]);
\treturn res.rows.map(rowToOrder);
}
`;
	}
	return `import { ensureSchema } from "./schema.mjs";

// Order model — CRUD for the orders table (JSONB doc column).
// References accounts via account_id FK.

export async function createOrder(client, data) {
\tawait ensureSchema(client);
\tconst doc = { ...data };
\tawait client.query('INSERT INTO orders (order_id, account_id, doc) VALUES ($1, $2, $3)', [doc.orderId, doc.accountId, JSON.stringify(doc)]);
\treturn doc;
}

export async function getOrder(client, orderId) {
\tconst res = await client.query('SELECT doc FROM orders WHERE order_id = $1', [orderId]);
\treturn res.rows[0]?.doc || null;
}

export async function updateOrder(client, orderId, data) {
\tconst existing = await getOrder(client, orderId);
\tif (!existing) return null;
\tconst updated = { ...existing, ...data };
\tawait client.query('UPDATE orders SET doc = $1 WHERE order_id = $2', [JSON.stringify(updated), orderId]);
\treturn updated;
}

export async function listOrdersByAccount(client, accountId) {
\tconst res = await client.query('SELECT doc FROM orders WHERE account_id = $1', [accountId]);
\treturn res.rows.map(r => r.doc);
}
`;
}

function generateInvoicesModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

// Invoice model — CRUD for the invoices collection.
// Invoices embed: invoice_line_items as array.
// References accounts via accountId, orders via orderId.

export async function createInvoice(db, data) {
\tawait ensureSchema(db);
\tconst result = await db.collection("invoices").insertOne(data);
\treturn { _id: result.insertedId, ...data };
}

export async function getInvoice(db, invoiceId) {
\treturn db.collection("invoices").findOne({ invoiceId });
}

export async function getInvoicesByOrder(db, orderId) {
\treturn db.collection("invoices").find({ orderId }).toArray();
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

// Invoice model — CRUD for the invoices table.
// Related tables: invoice_line_items, payments, credit_notes, tax_records.
// References accounts via account_id, orders via order_id.

function rowToInvoice(r) {
\tif (!r) return null;
\treturn { invoiceId: r.invoice_id, accountId: r.account_id, orderId: r.order_id, invoiceNumber: r.invoice_number, amountCents: r.amount_cents, taxCents: r.tax_cents, totalCents: r.total_cents, status: r.status, issuedAt: r.issued_at, dueAt: r.due_at, paidAt: r.paid_at };
}

export async function createInvoice(client, data) {
\tawait ensureSchema(client);
\tconst res = await client.query(
\t\t'INSERT INTO invoices (invoice_id, account_id, order_id, invoice_number, amount_cents, total_cents, status, issued_at, due_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
\t\t[data.invoiceId, data.accountId, data.orderId || null, data.invoiceNumber, data.amountCents, data.totalCents, data.status, data.issuedAt || new Date(), data.dueAt || new Date()]
\t);
\treturn rowToInvoice(res.rows[0]);
}

export async function getInvoice(client, invoiceId) {
\tconst res = await client.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoiceId]);
\treturn rowToInvoice(res.rows[0]);
}

export async function getInvoicesByOrder(client, orderId) {
\tconst res = await client.query('SELECT * FROM invoices WHERE order_id = $1', [orderId]);
\treturn res.rows.map(rowToInvoice);
}
`;
	}
	return `import { ensureSchema } from "./schema.mjs";

// Invoice model — CRUD for the invoices table (JSONB doc column).

export async function createInvoice(client, data) {
\tawait ensureSchema(client);
\tconst doc = { ...data };
\tawait client.query('INSERT INTO invoices (invoice_id, account_id, doc) VALUES ($1, $2, $3)', [doc.invoiceId, doc.accountId, JSON.stringify(doc)]);
\treturn doc;
}

export async function getInvoice(client, invoiceId) {
\tconst res = await client.query('SELECT doc FROM invoices WHERE invoice_id = $1', [invoiceId]);
\treturn res.rows[0]?.doc || null;
}

export async function getInvoicesByOrder(client, orderId) {
\tconst res = await client.query('SELECT doc FROM invoices WHERE doc->>\\'orderId\\' = $1', [orderId]);
\treturn res.rows.map(r => r.doc);
}
`;
}

function generateProductsModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

// Product model — CRUD for the products collection.
// Products embed: product_reviews, product_pricing as arrays.
// References product_categories via categoryId.

export async function createProduct(db, data) {
\tawait ensureSchema(db);
\tconst result = await db.collection("products").insertOne(data);
\treturn { _id: result.insertedId, ...data };
}

export async function getProduct(db, productId) {
\treturn db.collection("products").findOne({ productId });
}

export async function listProductsByCategory(db, categoryId) {
\treturn db.collection("products").find({ categoryId }).toArray();
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

// Product model — CRUD for the products table.
// Related tables: product_pricing, product_inventory, product_reviews.
// References product_categories via category_id.

function rowToProduct(r) {
\tif (!r) return null;
\treturn { productId: r.product_id, name: r.name, sku: r.sku, categoryId: r.category_id, description: r.description, isActive: r.is_active, launchedAt: r.launched_at };
}

export async function createProduct(client, data) {
\tawait ensureSchema(client);
\tconst res = await client.query(
\t\t'INSERT INTO products (product_id, name, sku, category_id, description, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
\t\t[data.productId, data.name, data.sku, data.categoryId || null, data.description || null, data.isActive !== undefined ? data.isActive : true]
\t);
\treturn rowToProduct(res.rows[0]);
}

export async function getProduct(client, productId) {
\tconst res = await client.query('SELECT * FROM products WHERE product_id = $1', [productId]);
\treturn rowToProduct(res.rows[0]);
}

export async function listProductsByCategory(client, categoryId) {
\tconst res = await client.query('SELECT * FROM products WHERE category_id = $1', [categoryId]);
\treturn res.rows.map(rowToProduct);
}
`;
	}
	return `import { ensureSchema } from "./schema.mjs";

// Product model — CRUD for the products table (JSONB doc column).

export async function createProduct(client, data) {
\tawait ensureSchema(client);
\tconst doc = { ...data };
\tawait client.query('INSERT INTO products (product_id, doc) VALUES ($1, $2)', [doc.productId, JSON.stringify(doc)]);
\treturn doc;
}

export async function getProduct(client, productId) {
\tconst res = await client.query('SELECT doc FROM products WHERE product_id = $1', [productId]);
\treturn res.rows[0]?.doc || null;
}

export async function listProductsByCategory(client, categoryId) {
\tconst res = await client.query('SELECT doc FROM products WHERE doc->>\\'categoryId\\' = $1', [categoryId]);
\treturn res.rows.map(r => r.doc);
}
`;
}

function generateSupportModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

// Support case model — CRUD for the support_cases collection.
// Support cases embed: case_comments, case_escalations, support_assignments as arrays.
// References accounts via accountId.

export async function createSupportCase(db, data) {
\tawait ensureSchema(db);
\tconst result = await db.collection("support_cases").insertOne(data);
\treturn { _id: result.insertedId, ...data };
}

export async function getSupportCase(db, caseId) {
\treturn db.collection("support_cases").findOne({ caseId });
}

export async function listCasesByAccount(db, accountId) {
\treturn db.collection("support_cases").find({ accountId }).toArray();
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

// Support case model — CRUD for the support_cases table.
// Related tables: case_comments, case_escalations, support_assignments, sla_policies.
// References accounts via account_id.

function rowToCase(r) {
\tif (!r) return null;
\treturn { caseId: r.case_id, accountId: r.account_id, subject: r.subject, priority: r.priority, status: r.status, openedAt: r.opened_at, resolvedAt: r.resolved_at, assignedTo: r.assigned_to };
}

export async function createSupportCase(client, data) {
\tawait ensureSchema(client);
\tconst res = await client.query(
\t\t'INSERT INTO support_cases (case_id, account_id, subject, priority, status, opened_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
\t\t[data.caseId, data.accountId, data.subject, data.priority, data.status, data.openedAt || new Date()]
\t);
\treturn rowToCase(res.rows[0]);
}

export async function getSupportCase(client, caseId) {
\tconst res = await client.query('SELECT * FROM support_cases WHERE case_id = $1', [caseId]);
\treturn rowToCase(res.rows[0]);
}

export async function listCasesByAccount(client, accountId) {
\tconst res = await client.query('SELECT * FROM support_cases WHERE account_id = $1', [accountId]);
\treturn res.rows.map(rowToCase);
}
`;
	}
	return `import { ensureSchema } from "./schema.mjs";

// Support case model — CRUD for the support_cases table (JSONB doc column).

export async function createSupportCase(client, data) {
\tawait ensureSchema(client);
\tconst doc = { ...data };
\tawait client.query('INSERT INTO support_cases (case_id, account_id, doc) VALUES ($1, $2, $3)', [doc.caseId, doc.accountId, JSON.stringify(doc)]);
\treturn doc;
}

export async function getSupportCase(client, caseId) {
\tconst res = await client.query('SELECT doc FROM support_cases WHERE case_id = $1', [caseId]);
\treturn res.rows[0]?.doc || null;
}

export async function listCasesByAccount(client, accountId) {
\tconst res = await client.query('SELECT doc FROM support_cases WHERE account_id = $1', [accountId]);
\treturn res.rows.map(r => r.doc);
}
`;
}

function generateQueriesModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

// Order summary query — combines order + account + line items + invoice + shipment info.
// Reads from: orders (with embedded lineItems), accounts, invoices, shipments collections.
// This query must be updated to include preferredPaymentMethod from the account.

export async function getOrderSummary(db, orderId) {
\tawait ensureSchema(db);
\tconst order = await db.collection("orders").findOne({ orderId });
\tif (!order) return null;
\tconst account = await db.collection("accounts").findOne({ accountId: order.accountId });
\tconst invoice = await db.collection("invoices").findOne({ orderId });
\tconst shipment = await db.collection("shipments").findOne({ orderId });
\treturn {
\t\torderId: order.orderId,
\t\tstatus: order.status,
\t\ttotalCents: order.totalCents,
\t\tcurrency: order.currency,
\t\tlineItems: order.lineItems || [],
\t\taccountName: account?.name,
\t\taccountTier: account?.tier,
\t\tinvoiceStatus: invoice?.status,
\t\tinvoiceAmountCents: invoice?.amountCents,
\t\tshipmentStatus: shipment?.status,
\t\tcarrier: shipment?.carrier,
\t};
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

// Order summary query — 5-table JOIN across orders, accounts, order_line_items,
// invoices, and shipments. This query must be updated to include
// preferredPaymentMethod from the accounts table.

export async function getOrderSummary(client, orderId) {
\tawait ensureSchema(client);
\tconst res = await client.query(\`
\t\tSELECT
\t\t\to.order_id AS "orderId",
\t\t\to.status,
\t\t\to.total_cents AS "totalCents",
\t\t\to.currency,
\t\t\ta.name AS "accountName",
\t\t\ta.tier AS "accountTier",
\t\t\ti.status AS "invoiceStatus",
\t\t\ti.amount_cents AS "invoiceAmountCents",
\t\t\ts.status AS "shipmentStatus",
\t\t\ts.carrier
\t\tFROM orders o
\t\tJOIN accounts a ON o.account_id = a.account_id
\t\tLEFT JOIN invoices i ON i.order_id = o.order_id
\t\tLEFT JOIN shipments s ON s.order_id = o.order_id
\t\tWHERE o.order_id = $1
\t\`, [orderId]);
\tif (!res.rows[0]) return null;
\tconst items = await client.query(
\t\t'SELECT product_name AS "productName", quantity, unit_price_cents AS "unitPriceCents", total_cents AS "totalCents" FROM order_line_items WHERE order_id = $1',
\t\t[orderId]
\t);
\treturn { ...res.rows[0], lineItems: items.rows };
}
`;
	}
	return `import { ensureSchema } from "./schema.mjs";

// Order summary query — reads from orders, accounts, invoices, shipments JSONB docs.

export async function getOrderSummary(client, orderId) {
\tawait ensureSchema(client);
\tconst orderRes = await client.query('SELECT doc FROM orders WHERE order_id = $1', [orderId]);
\tif (!orderRes.rows[0]) return null;
\tconst order = orderRes.rows[0].doc;
\tconst acctRes = await client.query('SELECT doc FROM accounts WHERE account_id = $1', [order.accountId]);
\tconst account = acctRes.rows[0]?.doc;
\tconst invRes = await client.query("SELECT doc FROM invoices WHERE doc->>'orderId' = $1", [orderId]);
\tconst invoice = invRes.rows[0]?.doc;
\tconst shipRes = await client.query("SELECT doc FROM shipments WHERE doc->>'orderId' = $1", [orderId]);
\tconst shipment = shipRes.rows[0]?.doc;
\treturn {
\t\torderId: order.orderId,
\t\tstatus: order.status,
\t\ttotalCents: order.totalCents,
\t\tcurrency: order.currency,
\t\tlineItems: order.lineItems || [],
\t\taccountName: account?.name,
\t\taccountTier: account?.tier,
\t\tinvoiceStatus: invoice?.status,
\t\tinvoiceAmountCents: invoice?.amountCents,
\t\tshipmentStatus: shipment?.status,
\t\tcarrier: shipment?.carrier,
\t};
}
`;
}

// ─── DB Helper (protected) ────────────────────────────────────────────────
function generateDbHelper(lane) {
	if (lane === "mongo") {
		return `import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
const cfg = JSON.parse(readFileSync(new URL("../db-config.json", import.meta.url), "utf8"));
export async function withDb(fn) {
\tconst client = new MongoClient(cfg.uri);
\tawait client.connect();
\ttry { return await fn(client.db(cfg.db)); } finally { await client.close(); }
}
export { cfg };
`;
	}
	return `import { readFileSync } from "node:fs";
import pg from "pg";
const cfg = JSON.parse(readFileSync(new URL("../db-config.json", import.meta.url), "utf8"));
export async function withDb(fn) {
\tconst client = new pg.Client({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database });
\tawait client.connect();
\tawait client.query('SET search_path TO "' + cfg.schema + '"');
\ttry { return await fn(client); } finally { await client.end(); }
}
export { cfg };
`;
}

// ─── Acceptance Tests (protected) ─────────────────────────────────────────
function generateAcceptanceTest(lane) {
	const common = `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount, getAccount, updateAccount } from "../src/accounts.mjs";
import { createOrder, getOrder } from "../src/orders.mjs";
import { createInvoice, getInvoice } from "../src/invoices.mjs";
import { getOrderSummary } from "../src/queries.mjs";

await withDb(async (${lane === "mongo" ? "db" : "client"}) => {
\tawait ensureSchema(${lane === "mongo" ? "db" : "client"});

\t// === REGRESSION: existing entities work without preferredPaymentMethod ===
\tconst acct = await createAccount(${lane === "mongo" ? "db" : "client"}, { accountId: "acct-test-1", name: "Enterprise Corp", tier: "strategic", status: "active", createdAt: new Date() });
\tok(acct, "regression: account created");

\tconst order = await createOrder(${lane === "mongo" ? "db" : "client"}, { orderId: "ord-test-1", accountId: "acct-test-1", status: "pending", totalCents: 75000, currency: "USD", createdAt: new Date() });
\tok(order, "regression: order created");

\tconst invoice = await createInvoice(${lane === "mongo" ? "db" : "client"}, { invoiceId: "inv-test-1", accountId: "acct-test-1", orderId: "ord-test-1", invoiceNumber: "INV-001", amountCents: 75000, totalCents: 75000, status: "sent", issuedAt: new Date(), dueAt: new Date() });
\tok(invoice, "regression: invoice created");

\tconst summary = await getOrderSummary(${lane === "mongo" ? "db" : "client"}, "ord-test-1");
\tok(summary, "regression: order summary returned");
\tstrictEqual(summary.orderId, "ord-test-1", "regression: order ID matches");
\tstrictEqual(summary.accountName, "Enterprise Corp", "regression: account name in summary");

\t// === NEW: preferredPaymentMethod ===
\tconst updated = await updateAccount(${lane === "mongo" ? "db" : "client"}, "acct-test-1", { preferredPaymentMethod: "wire_transfer" });
\tstrictEqual(updated.preferredPaymentMethod, "wire_transfer", "new: account has preferredPaymentMethod");

\t// Order summary must include preferredPaymentMethod
\tconst summaryWithPayment = await getOrderSummary(${lane === "mongo" ? "db" : "client"}, "ord-test-1");
\tstrictEqual(summaryWithPayment.preferredPaymentMethod, "wire_transfer", "new: order summary includes preferredPaymentMethod");
});

console.log("Enterprise benchmark acceptance passed: ${lane}");
`;
	return common;
}

// ─── Main Export ──────────────────────────────────────────────────────────
export function writeEnterpriseWorkspace({
	workspace,
	lane,
	taskType,
	ns,
	dbHandle,
}) {
	mkdirSync(join(workspace, "src"), { recursive: true });
	mkdirSync(join(workspace, "tests"), { recursive: true });

	// package.json
	writeFileSync(
		join(workspace, "package.json"),
		JSON.stringify(
			{
				name: `build-bench-enterprise-${lane}`,
				version: "1.0.0",
				private: true,
				type: "module",
				scripts: { test: "node tests/acceptance.test.mjs" },
			},
			null,
			2,
		) + "\n",
	);

	// db-config.json
	const dbCfg =
		lane === "mongo"
			? { uri: dbHandle.uri, db: ns }
			: {
					host: dbHandle.host || "127.0.0.1",
					port: dbHandle.port || 5433,
					user: dbHandle.user || "lab",
					password: dbHandle.password || "lab",
					database: dbHandle.database || "sql_hidden_cost",
					schema: ns,
				};
	writeFileSync(
		join(workspace, "db-config.json"),
		JSON.stringify(dbCfg, null, 2) + "\n",
	);

	// RULES.md
	writeFileSync(
		join(workspace, "RULES.md"),
		[
			"# Enterprise Benchmark — Change Request",
			"",
			"## Existing System",
			"",
			"The database has a 40-entity enterprise schema covering 6 business domains:",
			"Accounts (8 entities), Orders (10 entities), Financial (7 entities),",
			"Support (5 entities), Products (5 entities), Compliance (5 entities).",
			"",
			"Working CRUD code exists for: accounts, orders, invoices, products, support cases.",
			"A complex order summary query joins across multiple entities.",
			"",
			"Read `src/schema.mjs` to understand the full schema.",
			"Read `src/accounts.mjs`, `src/orders.mjs`, `src/invoices.mjs`,",
			"`src/products.mjs`, `src/support.mjs` to understand the model code.",
			"Read `src/queries.mjs` for the order summary query.",
			"",
			"## Change Request",
			"",
			"1. Add a **preferredPaymentMethod** field (string, optional, enum: credit_card/wire_transfer/ach/paypal) to the **accounts** entity.",
			"2. Update the **getOrderSummary** query in `src/queries.mjs` to include the account's preferredPaymentMethod in the result.",
			"",
			"## Rules",
			"",
			"- Do NOT break existing functionality — regression tests must pass.",
			"- Connect to the real database via `src/db.mjs` (do NOT edit this file).",
			"- Edit files under `src/` EXCEPT `src/db.mjs`. Do NOT modify anything under `tests/`.",
			"- Do NOT add any file-based or in-memory fallback.",
			"- Do NOT read skill files, run code reviews, or launch subagents. Just do the task directly.",
			"- Do NOT read any files outside this workspace directory.",
			"",
		].join("\n"),
	);

	// README.md
	writeFileSync(
		join(workspace, "README.md"),
		`# Enterprise Benchmark — ${lane}\n\n40-entity enterprise schema. Task: add preferredPaymentMethod to accounts + update order summary.\n\n\`\`\`sh\nnpm test\n\`\`\`\n`,
	);

	// AGENTS.md (minimal)
	writeFileSync(
		join(workspace, "AGENTS.md"),
		`# Agent — ${lane} (enterprise)\n\nLarge existing schema (40 entities). Read src/schema.mjs first.\nOnly edit src/ files except src/db.mjs. Do not edit tests/.\nDo NOT read skill files, run code reviews, or launch subagents.\n`,
	);

	// src/db.mjs (protected)
	writeFileSync(join(workspace, "src", "db.mjs"), generateDbHelper(lane));

	// src/schema.mjs (INLINE — the agent must read this)
	const schemaCode =
		lane === "mongo"
			? generateMongoSchemaCode()
			: lane === "postgres-norm"
				? generatePgNormSchemaCode()
				: generatePgJsonbSchemaCode();
	writeFileSync(join(workspace, "src", "schema.mjs"), schemaCode);

	// src/accounts.mjs (agent must modify)
	writeFileSync(
		join(workspace, "src", "accounts.mjs"),
		generateAccountsModel(lane),
	);

	// src/orders.mjs (read-only context)
	writeFileSync(
		join(workspace, "src", "orders.mjs"),
		generateOrdersModel(lane),
	);

	// src/invoices.mjs (read-only context)
	writeFileSync(
		join(workspace, "src", "invoices.mjs"),
		generateInvoicesModel(lane),
	);

	// src/products.mjs (read-only context)
	writeFileSync(
		join(workspace, "src", "products.mjs"),
		generateProductsModel(lane),
	);

	// src/support.mjs (read-only context)
	writeFileSync(
		join(workspace, "src", "support.mjs"),
		generateSupportModel(lane),
	);

	// src/queries.mjs (agent must modify)
	writeFileSync(
		join(workspace, "src", "queries.mjs"),
		generateQueriesModel(lane),
	);

	// tests/acceptance.test.mjs (protected)
	writeFileSync(
		join(workspace, "tests", "acceptance.test.mjs"),
		generateAcceptanceTest(lane),
	);

	// Link node_modules
	const repoModules = join(import.meta.dirname, "..", "node_modules");
	if (existsSync(repoModules)) {
		try {
			symlinkSync(repoModules, join(workspace, "node_modules"), "dir");
		} catch {
			/* already exists */
		}
	}
}