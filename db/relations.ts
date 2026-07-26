import { relations } from "drizzle-orm";
import {
  invoices,
  invoiceItems,
  creditNotes,
  creditNoteItems,
  customers,
  bankAccounts,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  deliveryNotes,
  deliveryNoteItems,
  reminders,
  offers,
  offerItems,
  products,
  konditionen,
} from "./schema";

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [invoices.bankAccountId],
    references: [bankAccounts.id],
  }),
  items: many(invoiceItems),
  creditNotes: many(creditNotes),
  deliveryNotes: many(deliveryNotes),
  reminders: many(reminders),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const creditNotesRelations = relations(creditNotes, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [creditNotes.invoiceId],
    references: [invoices.id],
  }),
  items: many(creditNoteItems),
}));

export const creditNoteItemsRelations = relations(creditNoteItems, ({ one }) => ({
  creditNote: one(creditNotes, {
    fields: [creditNoteItems.creditNoteId],
    references: [creditNotes.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
  }),
);

export const deliveryNotesRelations = relations(deliveryNotes, ({ one, many }) => ({
  customer: one(customers, {
    fields: [deliveryNotes.customerId],
    references: [customers.id],
  }),
  invoice: one(invoices, {
    fields: [deliveryNotes.invoiceId],
    references: [invoices.id],
  }),
  items: many(deliveryNoteItems),
}));

export const deliveryNoteItemsRelations = relations(
  deliveryNoteItems,
  ({ one }) => ({
    deliveryNote: one(deliveryNotes, {
      fields: [deliveryNoteItems.deliveryNoteId],
      references: [deliveryNotes.id],
    }),
  }),
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  invoice: one(invoices, {
    fields: [reminders.invoiceId],
    references: [invoices.id],
  }),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [offers.customerId],
    references: [customers.id],
  }),
  items: many(offerItems),
}));

export const offerItemsRelations = relations(offerItems, ({ one }) => ({
  offer: one(offers, {
    fields: [offerItems.offerId],
    references: [offers.id],
  }),
}));


export const konditionenRelations = relations(konditionen, ({ one }) => ({
  product: one(products, {
    fields: [konditionen.productId],
    references: [products.id],
  }),
}));

// ── PraxisWerk: Patientenakte ───────────────────────────────────────────────
import {
  patientContacts,
  therapyPlans,
  planEntries,
  documents,
  timelineEvents,
  users,
} from "./schema";

export const customersRelations = relations(customers, ({ many }) => ({
  kontakte: many(patientContacts),
  plaene: many(therapyPlans),
  dokumente: many(documents),
  timeline: many(timelineEvents),
}));

export const patientContactsRelations = relations(patientContacts, ({ one }) => ({
  patient: one(customers, {
    fields: [patientContacts.patientId],
    references: [customers.id],
  }),
}));

export const therapyPlansRelations = relations(therapyPlans, ({ one, many }) => ({
  patient: one(customers, {
    fields: [therapyPlans.patientId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [therapyPlans.createdBy],
    references: [users.id],
  }),
  entries: many(planEntries),
  dokumente: many(documents),
}));

export const planEntriesRelations = relations(planEntries, ({ one }) => ({
  plan: one(therapyPlans, {
    fields: [planEntries.planId],
    references: [therapyPlans.id],
  }),
  leistung: one(products, {
    fields: [planEntries.leistungId],
    references: [products.id],
  }),
  therapeut: one(users, {
    fields: [planEntries.therapeutId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  patient: one(customers, {
    fields: [documents.patientId],
    references: [customers.id],
  }),
  plan: one(therapyPlans, {
    fields: [documents.planId],
    references: [therapyPlans.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  patient: one(customers, {
    fields: [timelineEvents.patientId],
    references: [customers.id],
  }),
}));

// ── PraxiOS: Rollen-Gruppen ─────────────────────────────────────────────────
import { gruppen } from "./schema";

export const gruppenRelations = relations(gruppen, ({ many }) => ({
  mitglieder: many(users),
}));

// ── PraxiOS: Anamnesebögen ──────────────────────────────────────────────────
import { anamnesisForms, anamnesisLinks, anamnesisSubmissions } from "./schema";

export const anamnesisFormsRelations = relations(anamnesisForms, ({ many }) => ({
  links: many(anamnesisLinks),
}));

export const anamnesisLinksRelations = relations(anamnesisLinks, ({ one }) => ({
  form: one(anamnesisForms, {
    fields: [anamnesisLinks.formId],
    references: [anamnesisForms.id],
  }),
  patient: one(customers, {
    fields: [anamnesisLinks.patientId],
    references: [customers.id],
  }),
}));

export const anamnesisSubmissionsRelations = relations(
  anamnesisSubmissions,
  ({ one }) => ({
    link: one(anamnesisLinks, {
      fields: [anamnesisSubmissions.linkId],
      references: [anamnesisLinks.id],
    }),
    form: one(anamnesisForms, {
      fields: [anamnesisSubmissions.formId],
      references: [anamnesisForms.id],
    }),
    patient: one(customers, {
      fields: [anamnesisSubmissions.patientId],
      references: [customers.id],
    }),
  }),
);
