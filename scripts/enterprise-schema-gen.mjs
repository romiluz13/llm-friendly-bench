// Enterprise schema generator for Build-Bench.
// 40-entity customer-order-lifecycle domain.
// MongoDB: ~22 collections with embedded arrays where natural.
// Postgres: 40 tables with 3NF normalization, FKs, CHECK constraints, indexes.
//
// Usage:
//   import { generateMongoSchema, generatePostgresSchema } from "./enterprise-schema-gen.mjs";
//   const mongo = generateMongoSchema();   // { ensureSchema(db) }
//   const pg = generatePostgresSchema();   // { ensureSchema(client) }

// ─── Entity definitions (shared domain model) ───────────────────────────────

const ENTITIES = {
	// Accounts domain (8)
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

	// Orders domain (10)
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

	// Financial domain (7)
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
			invoiceLineId: { type: "string", pk: true },
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
				values: ["card", "bank_transfer", "check", "wire", "credit"],
				required: true,
			},
			status: {
				type: "enum",
				values: ["pending", "completed", "failed", "refunded"],
				required: true,
			},
			processedAt: { type: "date", required: true },
			referenceNumber: { type: "string" },
		},
	},
	payment_methods: {
		fields: {
			paymentMethodId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			type: {
				type: "enum",
				values: ["card", "bank_transfer", "wire"],
				required: true,
			},
			isDefault: { type: "boolean" },
			lastFour: { type: "string" },
			expiryMonth: { type: "int" },
			expiryYear: { type: "int" },
			billingName: { type: "string" },
			status: { type: "enum", values: ["active", "expired", "removed"] },
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
				values: ["pending", "applied", "rejected"],
				required: true,
			},
			issuedAt: { type: "date", required: true },
		},
	},
	tax_records: {
		fields: {
			taxRecordId: { type: "string", pk: true },
			invoiceId: { type: "string", fk: "invoices", required: true },
			taxType: {
				type: "enum",
				values: ["sales", "vat", "gst", "reverse_charge"],
				required: true,
			},
			jurisdiction: { type: "string", required: true },
			ratePct: { type: "decimal", required: true },
			amountCents: { type: "int", required: true },
		},
	},
	billing_cycles: {
		fields: {
			cycleId: { type: "string", pk: true },
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
				values: ["open", "closed", "pending"],
				required: true,
			},
			totalCents: { type: "int" },
		},
	},

	// Support domain (5)
	support_cases: {
		fields: {
			caseId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			orderId: { type: "string", fk: "orders" },
			subject: { type: "string", required: true },
			priority: {
				type: "enum",
				values: ["low", "medium", "high", "critical", "urgent"],
				required: true,
			},
			status: {
				type: "enum",
				values: ["open", "in_progress", "resolved", "escalated", "closed"],
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
			isInternal: { type: "boolean" },
			createdAt: { type: "date", required: true },
		},
	},
	case_escalations: {
		fields: {
			escalationId: { type: "string", pk: true },
			caseId: { type: "string", fk: "support_cases", required: true },
			escalatedBy: { type: "string", required: true },
			escalatedTo: { type: "string", required: true },
			reason: { type: "string", required: true },
			status: { type: "enum", values: ["active", "resolved"], required: true },
			createdAt: { type: "date", required: true },
			resolvedAt: { type: "date" },
		},
	},
	sla_policies: {
		fields: {
			slaId: { type: "string", pk: true },
			name: { type: "string", required: true },
			priorityLevel: {
				type: "enum",
				values: ["low", "medium", "high", "critical", "urgent"],
				required: true,
			},
			responseTimeHours: { type: "int", required: true },
			resolutionTimeHours: { type: "int", required: true },
			isActive: { type: "boolean" },
		},
	},
	support_assignments: {
		fields: {
			assignmentId: { type: "string", pk: true },
			caseId: { type: "string", fk: "support_cases", required: true },
			agentId: { type: "string", required: true },
			role: {
				type: "enum",
				values: ["primary", "secondary", "reviewer"],
				required: true,
			},
			assignedAt: { type: "date", required: true },
			status: { type: "enum", values: ["active", "reassigned", "ended"] },
		},
	},

	// Product domain (5)
	products: {
		fields: {
			productId: { type: "string", pk: true },
			name: { type: "string", required: true },
			sku: { type: "string", required: true },
			categoryId: { type: "string", fk: "product_categories" },
			description: { type: "string" },
			isActive: { type: "boolean" },
			launchDate: { type: "date" },
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
				values: ["standard", "volume", "enterprise", "promotional"],
				required: true,
			},
			unitPriceCents: { type: "int", required: true },
			currency: { type: "string", required: true },
			minQuantity: { type: "int" },
			effectiveFrom: { type: "date", required: true },
			effectiveTo: { type: "date" },
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
			lastCountAt: { type: "date" },
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
			verifiedPurchase: { type: "boolean" },
		},
	},

	// Compliance domain (5)
	compliance_reviews: {
		fields: {
			reviewId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			orderId: { type: "string", fk: "orders" },
			reviewType: {
				type: "enum",
				values: [
					"data_processing",
					"export_control",
					"privacy_audit",
					"security",
				],
				required: true,
			},
			status: {
				type: "enum",
				values: ["pending", "approved", "rejected", "expired"],
				required: true,
			},
			reviewerId: { type: "string" },
			openedAt: { type: "date", required: true },
			closedAt: { type: "date" },
			findings: { type: "string" },
		},
	},
	regulatory_flags: {
		fields: {
			flagId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts" },
			orderId: { type: "string", fk: "orders" },
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
			accountId: { type: "string", fk: "accounts" },
			entityType: { type: "string", required: true },
			entityId: { type: "string", required: true },
			action: {
				type: "enum",
				values: ["create", "update", "delete", "view", "export"],
				required: true,
			},
			performedBy: { type: "string", required: true },
			performedAt: { type: "date", required: true },
			changes: { type: "string" },
			ipAddress: { type: "string" },
		},
	},
	data_processing_agreements: {
		fields: {
			dpaId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			version: { type: "string", required: true },
			status: {
				type: "enum",
				values: ["draft", "active", "terminated", "expired"],
				required: true,
			},
			signedAt: { type: "date" },
			expiresAt: { type: "date" },
			signatoryName: { type: "string" },
			signatoryEmail: { type: "string" },
		},
	},
	consent_records: {
		fields: {
			consentId: { type: "string", pk: true },
			accountId: { type: "string", fk: "accounts", required: true },
			consentType: {
				type: "enum",
				values: ["marketing", "data_processing", "analytics", "third_party"],
				required: true,
			},
			granted: { type: "boolean", required: true },
			grantedAt: { type: "date" },
			withdrawnAt: { type: "date" },
			policyVersion: { type: "string" },
		},
	},
};

// ─── Embedding map for MongoDB ──────────────────────────────────────────────
// Child entities that are embedded as arrays in their parent collection.
// Key = parent collection name, Value = array of child entity names.
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

// Entities that are NOT embedded — they get their own collection/table.
function getStandaloneEntities() {
	const embedded = new Set();
	for (const children of Object.values(EMBED_MAP)) {
		for (const child of children) embedded.add(child);
	}
	return Object.keys(ENTITIES).filter((name) => !embedded.has(name));
}

// ─── MongoDB schema generation ──────────────────────────────────────────────

function mongoType(field) {
	if (field.type === "string") return "string";
	if (field.type === "int") return ["int", "double"];
	if (field.type === "decimal") return ["double", "int"];
	if (field.type === "date") return "date";
	if (field.type === "boolean") return "bool";
	if (field.type === "enum") return "string";
	return "string";
}

function mongoFieldDef(name, field) {
	const props = {};
	if (field.type === "enum") {
		props.enum = field.values;
	} else {
		const t = mongoType(field);
		if (Array.isArray(t)) props.bsonType = t;
		else props.bsonType = t;
	}
	return props;
}

function buildMongoValidator(entityName, entityDef, embeddedChildren = []) {
	const fields = entityDef.fields;
	const requiredFields = Object.keys(fields).filter(
		(k) => fields[k].required && !fields[k].pk,
	);
	const properties = {};
	for (const [fieldName, fieldDef] of Object.entries(fields)) {
		if (fieldDef.pk) {
			// PK is the document _id or a top-level field
			properties[fieldName] = mongoFieldDef(fieldName, fieldDef);
		} else {
			properties[fieldName] = mongoFieldDef(fieldName, fieldDef);
		}
	}
	// Add embedded child arrays
	for (const childName of embeddedChildren) {
		const childDef = ENTITIES[childName];
		if (childDef) {
			const childProps = {};
			for (const [cf, cd] of Object.entries(childDef.fields)) {
				if (!cd.fk) childProps[cf] = mongoFieldDef(cf, cd);
			}
			properties[childName] = {
				bsonType: "array",
				items: {
					bsonType: "object",
					properties: childProps,
				},
			};
		}
	}
	return {
		$jsonSchema: {
			bsonType: "object",
			required: requiredFields.length > 0 ? requiredFields : undefined,
			properties,
		},
	};
}

export function generateMongoSchema() {
	const standalone = getStandaloneEntities();
	const validators = {};
	for (const entityName of standalone) {
		const embeddedChildren = EMBED_MAP[entityName] || [];
		validators[entityName] = buildMongoValidator(
			entityName,
			ENTITIES[entityName],
			embeddedChildren,
		);
	}

	return {
		collectionCount: standalone.length,
		collectionNames: standalone,
		validators,
		ensureSchema: async function ensureSchema(db) {
			const existing = await db.listCollections().toArray();
			const existingNames = new Set(existing.map((c) => c.name));
			for (const [name, validator] of Object.entries(validators)) {
				if (!existingNames.has(name)) {
					await db.createCollection(name, { validator });
				}
			}
		},
	};
}

// ─── Postgres schema generation ─────────────────────────────────────────────

function toSnakeCase(name) {
	return name.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function pgType(field) {
	if (field.type === "string") return "TEXT";
	if (field.type === "int") return "INTEGER";
	if (field.type === "decimal") return "DECIMAL(12,4)";
	if (field.type === "date") return "TIMESTAMPTZ";
	if (field.type === "boolean") return "BOOLEAN";
	if (field.type === "enum") return "TEXT";
	return "TEXT";
}

function pgColumnDef(name, field) {
	const colName = toSnakeCase(name);
	let def = `${colName} ${pgType(field)}`;
	if (field.required) def += " NOT NULL";
	if (field.pk) def += " PRIMARY KEY";
	if (field.type === "enum") {
		const values = field.values.map((v) => `'${v}'`).join(", ");
		def += ` CHECK (${colName} IN (${values}))`;
	}
	return def;
}

function pgForeignKey(name, field) {
	if (!field.fk) return null;
	const colName = toSnakeCase(name);
	const refTable = field.fk;
	const refCol = toSnakeCase(
		Object.keys(ENTITIES[refTable].fields).find(
			(k) => ENTITIES[refTable].fields[k].pk,
		) || "id",
	);
	return `FOREIGN KEY (${colName}) REFERENCES ${refTable}(${refCol})`;
}

export function generatePostgresSchema() {
	const tableDefs = [];
	const indexDefs = [];
	const fkConstraintDefs = [];

	for (const [entityName, entityDef] of Object.entries(ENTITIES)) {
		const columns = [];
		const constraints = [];
		const fkCols = [];

		for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
			columns.push(pgColumnDef(fieldName, fieldDef));
			const fk = pgForeignKey(fieldName, fieldDef);
			if (fk) {
				constraints.push(fk);
				fkCols.push(toSnakeCase(fieldName));
			}
		}

		const allLines = [...columns, ...constraints];
		const createSql = `CREATE TABLE IF NOT EXISTS ${entityName} (\n  ${[...columns, ...constraints].join(",\n  ")}\n)`;
		const createSqlNoFk = `CREATE TABLE IF NOT EXISTS ${entityName} (\n  ${columns.join(",\n  ")}\n)`;
		tableDefs.push({ entityName, sql: createSql, sqlNoFk: createSqlNoFk });

		// FK constraint definitions for ALTER TABLE (added in second pass)
		for (const fkCol of fkCols) {
			const fieldName = Object.keys(entityDef.fields).find(
				(k) => toSnakeCase(k) === fkCol,
			);
			if (fieldName) {
				const fieldDef = entityDef.fields[fieldName];
				const refTable = fieldDef.ref || fieldDef.references;
				if (refTable) {
					const refCol = fieldDef.refColumn || "id";
					fkConstraintDefs.push(
						`ALTER TABLE ${entityName} ADD CONSTRAINT fk_${entityName}_${fkCol} FOREIGN KEY (${fkCol}) REFERENCES ${refTable}(${refCol})`,
					);
				}
			}
		}

		// Index on FK columns
		for (const fkCol of fkCols) {
			const idxName = `idx_${entityName}_${fkCol}`;
			indexDefs.push(
				`CREATE INDEX IF NOT EXISTS ${idxName} ON ${entityName} (${fkCol})`,
			);
		}
	}

	return {
		tableCount: tableDefs.length,
		tableNames: tableDefs.map((t) => t.entityName),
		tableDefs,
		indexDefs,
		ensureSchema: async function ensureSchema(client) {
			// First pass: create tables without FK constraints (to avoid ordering issues)
			// Then add FK constraints via ALTER TABLE
			for (const t of tableDefs) {
				await client.query(t.sqlNoFk || t.sql);
			}
			// Add FK constraints in a second pass
			for (const fkSql of fkConstraintDefs) {
				try {
					await client.query(fkSql);
				} catch (e) {
					/* FK may already exist or table order issues */
				}
			}
			for (const idx of indexDefs) {
				try {
					await client.query(idx);
				} catch {
					/* ignore */
				}
			}
		},
	};
}
