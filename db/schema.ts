import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  varchar,
  text,
  int,
  decimal,
  boolean,
  timestamp,
  date,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ── Firmen-Einstellungen (Singleton, id = 1) ────────────────────────────────
export const companySettings = mysqlTable("company_settings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  strasse: varchar("strasse", { length: 255 }).notNull(),
  plz: varchar("plz", { length: 20 }).notNull(),
  ort: varchar("ort", { length: 100 }).notNull(),
  land: varchar("land", { length: 100 }).notNull().default("Deutschland"),
  handelsregister: varchar("handelsregister", { length: 100 }),
  steuernummer: varchar("steuernummer", { length: 50 }),
  ustIdNr: varchar("ust_id_nr", { length: 50 }),
  email: varchar("email", { length: 320 }),
  telefon: varchar("telefon", { length: 50 }),
  webseite: varchar("webseite", { length: 255 }),
  standardZahlungsziel: int("standard_zahlungsziel").notNull().default(14),
  fussText: text("fuss_text"),
  // DATEV-Export (Buchungsstapel)
  datevBeraternummer: varchar("datev_beraternummer", { length: 20 }),
  datevMandantennummer: varchar("datev_mandantennummer", { length: 20 }),
  datevKontenrahmen: varchar("datev_kontenrahmen", { length: 10 }).notNull().default("SKR03"),
  erloeskonto19: varchar("erloeskonto_19", { length: 10 }).notNull().default("8400"),
  erloeskonto7: varchar("erloeskonto_7", { length: 10 }).notNull().default("8300"),
  erloeskonto0: varchar("erloeskonto_0", { length: 10 }).notNull().default("8120"),
  debitorStartnummer: int("debitor_startnummer").notNull().default(10000),
  // Design
  akzentfarbe: varchar("akzentfarbe", { length: 30 }).notNull().default("petrol"),
  pdfLayout: varchar("pdf_layout", { length: 30 }).notNull().default("klassisch"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ── Bankkonten ──────────────────────────────────────────────────────────────
export const bankAccounts = mysqlTable("bank_accounts", {
  id: serial("id").primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 100 }).notNull(),
  bankName: varchar("bank_name", { length: 255 }).notNull(),
  kontoinhaber: varchar("kontoinhaber", { length: 255 }).notNull(),
  iban: varchar("iban", { length: 40 }).notNull(),
  bic: varchar("bic", { length: 15 }),
  istStandard: boolean("ist_standard").notNull().default(false),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Kunden ──────────────────────────────────────────────────────────────────
export const customers = mysqlTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    zusatz: varchar("zusatz", { length: 255 }),
    strasse: varchar("strasse", { length: 255 }).notNull(),
    plz: varchar("plz", { length: 20 }).notNull(),
    ort: varchar("ort", { length: 100 }).notNull(),
    land: varchar("land", { length: 100 }).notNull().default("Deutschland"),
    email: varchar("email", { length: 320 }),
    telefon: varchar("telefon", { length: 50 }),
    // PraxisWerk: Patienten-Felder (Kunden = Patienten)
    geburtsdatum: date("geburtsdatum", { mode: "string" }),
    patientenNr: varchar("patienten_nr", { length: 50 }),
    krankenkasse: varchar("krankenkasse", { length: 255 }),
    versichertennummer: varchar("versichertennummer", { length: 50 }),
    aerztlicherAnsprechpartner: varchar("aerztlicher_ansprechpartner", { length: 255 }),
    tags: varchar("tags", { length: 500 }), // kommagetrennt, z. B. "borreliose,apherese"
    ustIdNr: varchar("ust_id_nr", { length: 50 }),
    zahlungszielTage: int("zahlungsziel_tage"),
    debitornummer: int("debitornummer"),
    notizen: text("notizen"),
    archiviert: boolean("archiviert").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index("customers_name_idx").on(t.name),
    patientenNrUnique: uniqueIndex("customers_patienten_nr_unique").on(t.patientenNr),
  }),
);

// ── Produkte / Leistungen ───────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  beschreibung: text("beschreibung"),
  einheit: varchar("einheit", { length: 30 }).notNull().default("Stück"),
  preisNetto: decimal("preis_netto", { precision: 12, scale: 2 }).notNull(),
  ekPreisNetto: decimal("ek_preis_netto", { precision: 12, scale: 2 }),
  // Dr.ReWaWi: "leistung" = ärztliche Leistung (GOÄ, VK-Preis) /
  // "auslage" = Auslage § 10 GOÄ (wird zum EK-Preis durchgereicht)
  kategorie: mysqlEnum("kategorie", ["leistung", "auslage"]).notNull().default("leistung"),
  // Alternative Schreibweisen aus dem Therapieplan (eine pro Zeile),
  // z. B. "250 ml Ringer" -> "Ringer-Lösung 250 ml"
  importNamen: text("import_namen"),
  ustSatz: int("ust_satz").notNull().default(19),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sonderpreise: abweichender VK (Kunde) bzw. EK (Lieferant) je Produkt
export const konditionen = mysqlTable(
  "konditionen",
  {
    id: serial("id").primaryKey(),
    typ: mysqlEnum("typ", ["kunde", "lieferant"]).notNull(),
    partnerId: bigint("partner_id", { mode: "number", unsigned: true }).notNull(),
    productId: bigint("product_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    preisNetto: decimal("preis_netto", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("konditionen_eindeutig").on(t.typ, t.partnerId, t.productId)],
);

// ── Nummernkreise (GoBD: lückenlos, nur hochzählen) ────────────────────────
// typ: "invoice" | "credit_note" | "delivery_note" | "purchase_order"
export const numberSequences = mysqlTable(
  "number_sequences",
  {
    id: serial("id").primaryKey(),
    typ: varchar("typ", { length: 30 }).notNull(),
    jahr: int("jahr").notNull(),
    letzteNummer: int("letzte_nummer").notNull().default(0),
  },
  (t) => ({
    uniqTypJahr: unique("uniq_typ_jahr").on(t.typ, t.jahr),
  }),
);

// ── Rechnungen ──────────────────────────────────────────────────────────────
export const invoices = mysqlTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    // Nummer wird erst bei Finalisierung vergeben (Entwürfe haben keine)
    nummer: varchar("nummer", { length: 20 }).unique(),
    status: mysqlEnum("status", ["entwurf", "finalisiert", "storniert"])
      .notNull()
      .default("entwurf"),
    customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull(),
    rechnungsdatum: date("rechnungsdatum", { mode: "string" }).notNull(),
    faelligkeitsdatum: date("faelligkeitsdatum", { mode: "string" }).notNull(),
    leistungsdatum: varchar("leistungsdatum", { length: 120 }),
    bankAccountId: bigint("bank_account_id", { mode: "number", unsigned: true }),
    // Kunden-Snapshot (wird beim Anlegen aus dem Kunden kopiert, danach editierbar)
    kundeName: varchar("kunde_name", { length: 255 }).notNull(),
    kundeZusatz: varchar("kunde_zusatz", { length: 255 }),
    kundeStrasse: varchar("kunde_strasse", { length: 255 }).notNull(),
    kundePlz: varchar("kunde_plz", { length: 20 }).notNull(),
    kundeOrt: varchar("kunde_ort", { length: 100 }).notNull(),
    kundeLand: varchar("kunde_land", { length: 100 }).notNull().default("Deutschland"),
    // Firmen- und Bank-Snapshot bei Finalisierung (JSON)
    firmenSnapshot: text("firmen_snapshot"),
    bankSnapshot: text("bank_snapshot"),
    // Summen (serverseitig berechnet)
    netto: decimal("netto", { precision: 12, scale: 2 }).notNull().default("0"),
    ust: decimal("ust", { precision: 12, scale: 2 }).notNull().default("0"),
    brutto: decimal("brutto", { precision: 12, scale: 2 }).notNull().default("0"),
    bezahltBetrag: decimal("bezahlt_betrag", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    bezahltAm: date("bezahlt_am", { mode: "string" }),
    bereitsBezahlt: boolean("bereits_bezahlt").notNull().default(false),
    pdfNotiz: text("pdf_notiz"),
    bemerkung: text("bemerkung"),
    finalizedAt: timestamp("finalized_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    statusIdx: index("invoices_status_idx").on(t.status),
    datumIdx: index("invoices_datum_idx").on(t.rechnungsdatum),
  }),
);

export const invoiceItems = mysqlTable(
  "invoice_items",
  {
    id: serial("id").primaryKey(),
    invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).notNull(),
    position: int("position").notNull(),
    bezeichnung: varchar("bezeichnung", { length: 500 }).notNull(),
    beschreibung: text("beschreibung"),
    menge: decimal("menge", { precision: 10, scale: 3 }).notNull().default("1"),
    einheit: varchar("einheit", { length: 30 }).notNull().default("Stück"),
    einzelpreis: decimal("einzelpreis", { precision: 12, scale: 2 }).notNull(),
    ustSatz: int("ust_satz").notNull().default(19),
  },
  (t) => ({
    invoiceIdx: index("invoice_items_invoice_idx").on(t.invoiceId),
  }),
);

// ── Gutschriften (Storno) ───────────────────────────────────────────────────
export const creditNotes = mysqlTable(
  "credit_notes",
  {
    id: serial("id").primaryKey(),
    nummer: varchar("nummer", { length: 20 }).unique(),
    status: mysqlEnum("status", ["entwurf", "finalisiert"])
      .notNull()
      .default("entwurf"),
    invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).notNull(),
    datum: date("datum", { mode: "string" }).notNull(),
    grund: text("grund"),
    bankAccountId: bigint("bank_account_id", { mode: "number", unsigned: true }),
    // Kunden-Snapshot
    kundeName: varchar("kunde_name", { length: 255 }).notNull(),
    kundeZusatz: varchar("kunde_zusatz", { length: 255 }),
    kundeStrasse: varchar("kunde_strasse", { length: 255 }).notNull(),
    kundePlz: varchar("kunde_plz", { length: 20 }).notNull(),
    kundeOrt: varchar("kunde_ort", { length: 100 }).notNull(),
    kundeLand: varchar("kunde_land", { length: 100 }).notNull().default("Deutschland"),
    firmenSnapshot: text("firmen_snapshot"),
    netto: decimal("netto", { precision: 12, scale: 2 }).notNull().default("0"),
    ust: decimal("ust", { precision: 12, scale: 2 }).notNull().default("0"),
    brutto: decimal("brutto", { precision: 12, scale: 2 }).notNull().default("0"),
    finalizedAt: timestamp("finalized_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    invoiceIdx: index("credit_notes_invoice_idx").on(t.invoiceId),
  }),
);

export const creditNoteItems = mysqlTable(
  "credit_note_items",
  {
    id: serial("id").primaryKey(),
    creditNoteId: bigint("credit_note_id", { mode: "number", unsigned: true }).notNull(),
    position: int("position").notNull(),
    bezeichnung: varchar("bezeichnung", { length: 500 }).notNull(),
    beschreibung: text("beschreibung"),
    menge: decimal("menge", { precision: 10, scale: 3 }).notNull().default("1"),
    einheit: varchar("einheit", { length: 30 }).notNull().default("Stück"),
    einzelpreis: decimal("einzelpreis", { precision: 12, scale: 2 }).notNull(),
    ustSatz: int("ust_satz").notNull().default(19),
  },
  (t) => ({
    creditIdx: index("credit_note_items_credit_idx").on(t.creditNoteId),
  }),
);

// ── Types ───────────────────────────────────────────────────────────────────
export type CompanySettings = typeof companySettings.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type Customer = typeof customers.$inferSelect;
// PraxisWerk: Kunde = Patient (vereinigtes Modell)
export type Patient = Customer;
export type Product = typeof products.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type CreditNote = typeof creditNotes.$inferSelect;
export type CreditNoteItem = typeof creditNoteItems.$inferSelect;

// ── Lieferanten ─────────────────────────────────────────────────────────────
export const suppliers = mysqlTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    zusatz: varchar("zusatz", { length: 255 }),
    strasse: varchar("strasse", { length: 255 }).notNull(),
    plz: varchar("plz", { length: 20 }).notNull(),
    ort: varchar("ort", { length: 100 }).notNull(),
    land: varchar("land", { length: 100 }).notNull().default("Deutschland"),
    email: varchar("email", { length: 320 }),
    telefon: varchar("telefon", { length: 50 }),
    ustIdNr: varchar("ust_id_nr", { length: 50 }),
    notizen: text("notizen"),
    archiviert: boolean("archiviert").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index("suppliers_name_idx").on(t.name),
  }),
);

// ── Bestellungen (Einkauf) ──────────────────────────────────────────────────
export const purchaseOrders = mysqlTable(
  "purchase_orders",
  {
    id: serial("id").primaryKey(),
    nummer: varchar("nummer", { length: 20 }).unique(),
    status: mysqlEnum("status", [
      "entwurf",
      "bestellt",
      "teilgeliefert",
      "geliefert",
      "storniert",
    ])
      .notNull()
      .default("entwurf"),
    supplierId: bigint("supplier_id", { mode: "number", unsigned: true }).notNull(),
    bestelldatum: date("bestelldatum", { mode: "string" }).notNull(),
    lieferdatum: date("lieferdatum", { mode: "string" }),
    // Lieferanten-Snapshot
    lieferantName: varchar("lieferant_name", { length: 255 }).notNull(),
    lieferantZusatz: varchar("lieferant_zusatz", { length: 255 }),
    lieferantStrasse: varchar("lieferant_strasse", { length: 255 }).notNull(),
    lieferantPlz: varchar("lieferant_plz", { length: 20 }).notNull(),
    lieferantOrt: varchar("lieferant_ort", { length: 100 }).notNull(),
    lieferantLand: varchar("lieferant_land", { length: 100 })
      .notNull()
      .default("Deutschland"),
    firmenSnapshot: text("firmen_snapshot"),
    pdfNotiz: text("pdf_notiz"),
    bemerkung: text("bemerkung"),
    netto: decimal("netto", { precision: 12, scale: 2 }).notNull().default("0"),
    ust: decimal("ust", { precision: 12, scale: 2 }).notNull().default("0"),
    brutto: decimal("brutto", { precision: 12, scale: 2 }).notNull().default("0"),
    bestelltAt: timestamp("bestellt_at"),
    geliefertAm: date("geliefert_am", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    statusIdx: index("po_status_idx").on(t.status),
    supplierIdx: index("po_supplier_idx").on(t.supplierId),
  }),
);

export const purchaseOrderItems = mysqlTable(
  "purchase_order_items",
  {
    id: serial("id").primaryKey(),
    purchaseOrderId: bigint("purchase_order_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    position: int("position").notNull(),
    bezeichnung: varchar("bezeichnung", { length: 500 }).notNull(),
    beschreibung: text("beschreibung"),
    menge: decimal("menge", { precision: 10, scale: 3 }).notNull().default("1"),
    einheit: varchar("einheit", { length: 30 }).notNull().default("Stück"),
    einzelpreis: decimal("einzelpreis", { precision: 12, scale: 2 }).notNull(),
    ustSatz: int("ust_satz").notNull().default(19),
  },
  (t) => ({
    poIdx: index("po_items_po_idx").on(t.purchaseOrderId),
  }),
);

// ── Lieferscheine (Verkauf, ohne Preise) ────────────────────────────────────
export const deliveryNotes = mysqlTable(
  "delivery_notes",
  {
    id: serial("id").primaryKey(),
    nummer: varchar("nummer", { length: 20 }).unique(),
    status: mysqlEnum("status", ["entwurf", "finalisiert", "storniert"])
      .notNull()
      .default("entwurf"),
    customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull(),
    invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }),
    datum: date("datum", { mode: "string" }).notNull(),
    // Kunden-Snapshot
    kundeName: varchar("kunde_name", { length: 255 }).notNull(),
    kundeZusatz: varchar("kunde_zusatz", { length: 255 }),
    kundeStrasse: varchar("kunde_strasse", { length: 255 }).notNull(),
    kundePlz: varchar("kunde_plz", { length: 20 }).notNull(),
    kundeOrt: varchar("kunde_ort", { length: 100 }).notNull(),
    kundeLand: varchar("kunde_land", { length: 100 }).notNull().default("Deutschland"),
    firmenSnapshot: text("firmen_snapshot"),
    pdfNotiz: text("pdf_notiz"),
    bemerkung: text("bemerkung"),
    finalizedAt: timestamp("finalized_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    customerIdx: index("dn_customer_idx").on(t.customerId),
    invoiceIdx: index("dn_invoice_idx").on(t.invoiceId),
  }),
);

export const deliveryNoteItems = mysqlTable(
  "delivery_note_items",
  {
    id: serial("id").primaryKey(),
    deliveryNoteId: bigint("delivery_note_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    position: int("position").notNull(),
    bezeichnung: varchar("bezeichnung", { length: 500 }).notNull(),
    beschreibung: text("beschreibung"),
    menge: decimal("menge", { precision: 10, scale: 3 }).notNull().default("1"),
    einheit: varchar("einheit", { length: 30 }).notNull().default("Stück"),
  },
  (t) => ({
    dnIdx: index("dn_items_dn_idx").on(t.deliveryNoteId),
  }),
);

export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type DeliveryNote = typeof deliveryNotes.$inferSelect;
export type DeliveryNoteItem = typeof deliveryNoteItems.$inferSelect;

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Farbe des Therapeuten im Kalender (z. B. "#0F766E")
  kalenderFarbe: varchar("kalenderFarbe", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Mahnwesen (Zahlungserinnerungen/Mahnungen zu Rechnungen) ────────────────
export const reminders = mysqlTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).notNull(),
    stufe: int("stufe").notNull(), // 1 = Zahlungserinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung
    datum: date("datum", { mode: "string" }).notNull(),
    zahlungsfrist: date("zahlungsfrist", { mode: "string" }).notNull(),
    offenBetrag: decimal("offen_betrag", { precision: 12, scale: 2 }).notNull(),
    bemerkung: text("bemerkung"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    reIdx: index("reminders_invoice_idx").on(t.invoiceId),
  }),
);

// ── Angebote ────────────────────────────────────────────────────────────────
export const offers = mysqlTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    nummer: varchar("nummer", { length: 20 }).unique(),
    status: mysqlEnum("status", ["entwurf", "finalisiert", "umgewandelt", "storniert"])
      .notNull()
      .default("entwurf"),
    customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull(),
    datum: date("datum", { mode: "string" }).notNull(),
    gueltigBis: date("gueltig_bis", { mode: "string" }),
    kundeName: varchar("kunde_name", { length: 255 }).notNull(),
    kundeZusatz: varchar("kunde_zusatz", { length: 255 }),
    kundeStrasse: varchar("kunde_strasse", { length: 255 }).notNull(),
    kundePlz: varchar("kunde_plz", { length: 20 }).notNull(),
    kundeOrt: varchar("kunde_ort", { length: 100 }).notNull(),
    kundeLand: varchar("kunde_land", { length: 100 }).notNull().default("Deutschland"),
    firmenSnapshot: text("firmen_snapshot"),
    netto: decimal("netto", { precision: 12, scale: 2 }).notNull().default("0"),
    ust: decimal("ust", { precision: 12, scale: 2 }).notNull().default("0"),
    brutto: decimal("brutto", { precision: 12, scale: 2 }).notNull().default("0"),
    pdfNotiz: text("pdf_notiz"),
    bemerkung: text("bemerkung"),
    convertedInvoiceId: bigint("converted_invoice_id", { mode: "number", unsigned: true }),
    finalizedAt: timestamp("finalized_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    statusIdx: index("offers_status_idx").on(t.status),
  }),
);

export const offerItems = mysqlTable(
  "offer_items",
  {
    id: serial("id").primaryKey(),
    offerId: bigint("offer_id", { mode: "number", unsigned: true }).notNull(),
    position: int("position").notNull(),
    bezeichnung: varchar("bezeichnung", { length: 255 }).notNull(),
    beschreibung: text("beschreibung"),
    menge: decimal("menge", { precision: 12, scale: 3 }).notNull(),
    einheit: varchar("einheit", { length: 30 }).notNull().default("Stück"),
    einzelpreis: decimal("einzelpreis", { precision: 12, scale: 2 }).notNull(),
    ustSatz: int("ust_satz").notNull().default(19),
  },
  (t) => ({
    angebotIdx: index("offer_items_offer_idx").on(t.offerId),
  }),
);

export type Reminder = typeof reminders.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type OfferItem = typeof offerItems.$inferSelect;

// ── Dr.ReWaWi: Abgerechnete Therapiewochen (Duplikatsschutz) ───────────────────
// Pro Patient (customerId) und Kalenderwoche max. eine Rechnung —
// gilt auch für Entwürfe, damit ein erneuter Import nicht doppelt anlegt.
export const invoiceTherapieWochen = mysqlTable(
  "invoice_therapie_wochen",
  {
    id: serial("id").primaryKey(),
    invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).notNull(),
    customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull(),
    jahr: int("jahr").notNull(),
    kw: int("kw").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("therapie_woche_eindeutig").on(t.customerId, t.jahr, t.kw),
    index("therapie_woche_invoice_idx").on(t.invoiceId),
  ],
);

// ── Dr.ReWaWi: Protokoll der Therapieplan-Importe (Audit + Report-Nachdownload) ─
export const therapyImports = mysqlTable("therapy_imports", {
  id: serial("id").primaryKey(),
  dateiname: varchar("dateiname", { length: 255 }).notNull(),
  jahr: int("jahr").notNull(),
  sheets: text("sheets").notNull(), // JSON: string[]
  ergebnis: text("ergebnis").notNull(), // JSON: ImportErgebnis (s. contracts/therapy.ts)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InvoiceTherapieWoche = typeof invoiceTherapieWochen.$inferSelect;
export type TherapyImport = typeof therapyImports.$inferSelect;

// ── PraxisWerk: Patientenakte (aus PraxisAkte; patientId = customers.id) ────
export const patientContacts = mysqlTable("patient_contacts", {
  id: serial("id").primaryKey(),
  patientId: bigint("patient_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  verhaeltnis: varchar("verhaeltnis", { length: 100 }),
  telefon: varchar("telefon", { length: 50 }),
  email: varchar("email", { length: 320 }),
  adresse: varchar("adresse", { length: 500 }),
  istRechnungsempfaenger: boolean("ist_rechnungsempfaenger").notNull().default(false),
  notiz: varchar("notiz", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const therapyPlans = mysqlTable(
  "therapy_plans",
  {
    id: serial("id").primaryKey(),
    patientId: bigint("patient_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    titel: varchar("titel", { length: 255 }),
    vonDatum: date("von_datum", { mode: "string" }).notNull(),
    bisDatum: date("bis_datum", { mode: "string" }).notNull(),
    diagnoseZiele: text("diagnose_ziele"),
    status: mysqlEnum("status", ["geplant", "aktiv", "dokumentiert", "abgerechnet"])
      .notNull()
      .default("geplant"),
    rechnungsempfaengerAbweichend: boolean("rechnungsempfaenger_abweichend")
      .notNull()
      .default(false),
    abweichenderEmpfaenger: text("abweichender_empfaenger"),
    notizen: text("notizen"),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("therapy_plans_patient_idx").on(t.patientId),
    index("therapy_plans_status_idx").on(t.status),
  ],
);

export const planEntries = mysqlTable(
  "plan_entries",
  {
    id: serial("id").primaryKey(),
    planId: bigint("plan_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => therapyPlans.id, { onDelete: "cascade" }),
    datum: date("datum", { mode: "string" }).notNull(),
    zeitVon: varchar("zeit_von", { length: 5 }),
    zeitBis: varchar("zeit_bis", { length: 5 }),
    leistungId: bigint("leistung_id", { mode: "number", unsigned: true }).references(
      () => products.id,
      { onDelete: "set null" },
    ),
    leistungText: varchar("leistung_text", { length: 255 }),
    menge: decimal("menge", { precision: 6, scale: 1 }).notNull().default("1"),
    therapeutId: bigint("therapeut_id", { mode: "number", unsigned: true }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    raum: varchar("raum", { length: 100 }),
    status: mysqlEnum("status", ["geplant", "stattgefunden", "abgesagt", "ausgefallen"])
      .notNull()
      .default("geplant"),
    bemerkung: varchar("bemerkung", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("plan_entries_datum_idx").on(t.datum),
    index("plan_entries_plan_idx").on(t.planId),
  ],
);

export const documents = mysqlTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    patientId: bigint("patient_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    planId: bigint("plan_id", { mode: "number", unsigned: true }).references(
      () => therapyPlans.id,
      { onDelete: "set null" },
    ),
    kategorie: mysqlEnum("kategorie", [
      "befund",
      "arztbrief",
      "rezept",
      "einverstaendnis",
      "sonstiges",
    ])
      .notNull()
      .default("sonstiges"),
    dateiname: varchar("dateiname", { length: 255 }).notNull(),
    dateipfad: varchar("dateipfad", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    groesse: int("groesse", { unsigned: true }),
    notiz: varchar("notiz", { length: 500 }),
    uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("documents_patient_idx").on(t.patientId)],
);

export const timelineEvents = mysqlTable(
  "timeline_events",
  {
    id: serial("id").primaryKey(),
    patientId: bigint("patient_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    typ: mysqlEnum("typ", ["plan", "termin", "dokument", "notiz", "status"]).notNull(),
    titel: varchar("titel", { length: 255 }).notNull(),
    beschreibung: text("beschreibung"),
    datum: date("datum", { mode: "string" }).notNull(),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("timeline_patient_datum_idx").on(t.patientId, t.datum)],
);

export const loeschprotokoll = mysqlTable("loeschprotokoll", {
  id: serial("id").primaryKey(),
  patientenNr: varchar("patienten_nr", { length: 50 }),
  patientKuerzel: varchar("patient_kuerzel", { length: 20 }),
  umfang: varchar("umfang", { length: 255 }),
  grund: varchar("grund", { length: 500 }),
  geloeschtVon: varchar("geloescht_von", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PatientContact = typeof patientContacts.$inferSelect;
export type TherapyPlan = typeof therapyPlans.$inferSelect;
export type PlanEntry = typeof planEntries.$inferSelect;
export type Dokument = typeof documents.$inferSelect;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type LoeschprotokollEintrag = typeof loeschprotokoll.$inferSelect;
