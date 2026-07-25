// Selbst-Migration beim Start: legt Spalten an, die aeltere Datenbanken
// noch nicht haben (idempotent — prueft erst information_schema).
// Frische Installationen kommen komplett aus schema.sql; diese Liste
// betrifft Bestandsdatenbanken aus aelteren Versionen.
import { sql } from "drizzle-orm";
import { getDb } from "./queries/connection";

const NEUE_SPALTEN: { tabelle: string; spalte: string; ddl: string }[] = [
  // Eigenes Login (Stufe 3)
  { tabelle: "users", spalte: "username", ddl: "ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL AFTER unionId" },
  { tabelle: "users", spalte: "passwordHash", ddl: "ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255) NULL AFTER username" },
  // Design-System (Stufe 4)
  { tabelle: "company_settings", spalte: "akzentfarbe", ddl: "ALTER TABLE company_settings ADD COLUMN akzentfarbe VARCHAR(30) NOT NULL DEFAULT 'neutral'" },
  { tabelle: "company_settings", spalte: "pdf_layout", ddl: "ALTER TABLE company_settings ADD COLUMN pdf_layout VARCHAR(30) NOT NULL DEFAULT 'klassisch'" },
  // EK/VK + Konditionen (Stufe 5)
  { tabelle: "products", spalte: "ek_preis_netto", ddl: "ALTER TABLE products ADD COLUMN ek_preis_netto DECIMAL(12,2) NULL AFTER preis_netto" },
  // Dr.ReWaWi (Fork)
  { tabelle: "products", spalte: "kategorie", ddl: "ALTER TABLE products ADD COLUMN kategorie ENUM('leistung','auslage') NOT NULL DEFAULT 'leistung' AFTER ek_preis_netto" },
  { tabelle: "products", spalte: "import_namen", ddl: "ALTER TABLE products ADD COLUMN import_namen TEXT NULL AFTER kategorie" },
  { tabelle: "customers", spalte: "geburtsdatum", ddl: "ALTER TABLE customers ADD COLUMN geburtsdatum DATE NULL AFTER telefon" },
  { tabelle: "customers", spalte: "patienten_nr", ddl: "ALTER TABLE customers ADD COLUMN patienten_nr VARCHAR(50) NULL AFTER geburtsdatum" },
  // PraxisWerk (Akte-Merge)
  { tabelle: "customers", spalte: "krankenkasse", ddl: "ALTER TABLE customers ADD COLUMN krankenkasse VARCHAR(255) NULL AFTER patienten_nr" },
  { tabelle: "customers", spalte: "versichertennummer", ddl: "ALTER TABLE customers ADD COLUMN versichertennummer VARCHAR(50) NULL AFTER krankenkasse" },
  { tabelle: "customers", spalte: "aerztlicher_ansprechpartner", ddl: "ALTER TABLE customers ADD COLUMN aerztlicher_ansprechpartner VARCHAR(255) NULL AFTER versichertennummer" },
  { tabelle: "customers", spalte: "tags", ddl: "ALTER TABLE customers ADD COLUMN tags VARCHAR(500) NULL AFTER aerztlicher_ansprechpartner" },
  { tabelle: "users", spalte: "kalenderFarbe", ddl: "ALTER TABLE users ADD COLUMN kalenderFarbe VARCHAR(20) NULL AFTER role" },
];

// Spalten-Aenderungen (Enum-Erweiterungen, idempotent per SHOW COLUMNS)
const SPALTEN_AENDERUNGEN: { tabelle: string; spalte: string; ddl: string; pruefWert: string }[] = [
  {
    tabelle: "documents",
    spalte: "kategorie",
    ddl: "ALTER TABLE documents MODIFY COLUMN kategorie ENUM('befund','arztbrief','rezept','einverstaendnis','anamnesebogen','sonstiges') NOT NULL DEFAULT 'sonstiges'",
    pruefWert: "anamnesebogen",
  },
];

const NEUE_TABELLEN: { tabelle: string; ddl: string }[] = [
  {
    tabelle: "konditionen",
    ddl: `CREATE TABLE IF NOT EXISTS konditionen (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      typ ENUM('kunde','lieferant') NOT NULL,
      partner_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      preis_netto DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX konditionen_eindeutig (typ, partner_id, product_id),
      CONSTRAINT konditionen_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
  },
  // Dr.ReWaWi (Fork)
  {
    tabelle: "invoice_therapie_wochen",
    ddl: `CREATE TABLE IF NOT EXISTS invoice_therapie_wochen (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      invoice_id BIGINT UNSIGNED NOT NULL,
      customer_id BIGINT UNSIGNED NOT NULL,
      jahr INT NOT NULL,
      kw INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX therapie_woche_eindeutig (customer_id, jahr, kw),
      INDEX therapie_woche_invoice_idx (invoice_id)
    )`,
  },
  {
    tabelle: "therapy_imports",
    ddl: `CREATE TABLE IF NOT EXISTS therapy_imports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      dateiname VARCHAR(255) NOT NULL,
      jahr INT NOT NULL,
      sheets TEXT NOT NULL,
      ergebnis TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  // PraxisWerk (Akte-Merge)
  {
    tabelle: "patient_contacts",
    ddl: `CREATE TABLE IF NOT EXISTS patient_contacts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      verhaeltnis VARCHAR(100) NULL,
      telefon VARCHAR(50) NULL,
      email VARCHAR(320) NULL,
      adresse VARCHAR(500) NULL,
      ist_rechnungsempfaenger TINYINT(1) NOT NULL DEFAULT 0,
      notiz VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT kontakte_patient_fk FOREIGN KEY (patient_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
  },
  {
    tabelle: "therapy_plans",
    ddl: `CREATE TABLE IF NOT EXISTS therapy_plans (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      titel VARCHAR(255) NULL,
      von_datum DATE NOT NULL,
      bis_datum DATE NOT NULL,
      diagnose_ziele TEXT NULL,
      status ENUM('geplant','aktiv','dokumentiert','abgerechnet') NOT NULL DEFAULT 'geplant',
      rechnungsempfaenger_abweichend TINYINT(1) NOT NULL DEFAULT 0,
      abweichender_empfaenger TEXT NULL,
      notizen TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX therapy_plans_patient_idx (patient_id),
      INDEX therapy_plans_status_idx (status),
      CONSTRAINT plans_patient_fk FOREIGN KEY (patient_id) REFERENCES customers(id) ON DELETE CASCADE,
      CONSTRAINT plans_user_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
  },
  {
    tabelle: "plan_entries",
    ddl: `CREATE TABLE IF NOT EXISTS plan_entries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      plan_id BIGINT UNSIGNED NOT NULL,
      datum DATE NOT NULL,
      zeit_von VARCHAR(5) NULL,
      zeit_bis VARCHAR(5) NULL,
      leistung_id BIGINT UNSIGNED NULL,
      leistung_text VARCHAR(255) NULL,
      menge DECIMAL(6,1) NOT NULL DEFAULT '1',
      therapeut_id BIGINT UNSIGNED NULL,
      raum VARCHAR(100) NULL,
      status ENUM('geplant','stattgefunden','abgesagt','ausgefallen') NOT NULL DEFAULT 'geplant',
      bemerkung VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX plan_entries_datum_idx (datum),
      INDEX plan_entries_plan_idx (plan_id),
      CONSTRAINT entries_plan_fk FOREIGN KEY (plan_id) REFERENCES therapy_plans(id) ON DELETE CASCADE,
      CONSTRAINT entries_leistung_fk FOREIGN KEY (leistung_id) REFERENCES products(id) ON DELETE SET NULL,
      CONSTRAINT entries_therapeut_fk FOREIGN KEY (therapeut_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
  },
  {
    tabelle: "documents",
    ddl: `CREATE TABLE IF NOT EXISTS documents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      plan_id BIGINT UNSIGNED NULL,
      kategorie ENUM('befund','arztbrief','rezept','einverstaendnis','sonstiges') NOT NULL DEFAULT 'sonstiges',
      dateiname VARCHAR(255) NOT NULL,
      dateipfad VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100) NULL,
      groesse INT UNSIGNED NULL,
      notiz VARCHAR(500) NULL,
      uploaded_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX documents_patient_idx (patient_id),
      CONSTRAINT docs_patient_fk FOREIGN KEY (patient_id) REFERENCES customers(id) ON DELETE CASCADE,
      CONSTRAINT docs_plan_fk FOREIGN KEY (plan_id) REFERENCES therapy_plans(id) ON DELETE SET NULL,
      CONSTRAINT docs_user_fk FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
  },
  {
    tabelle: "timeline_events",
    ddl: `CREATE TABLE IF NOT EXISTS timeline_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      typ ENUM('plan','termin','dokument','notiz','status') NOT NULL,
      titel VARCHAR(255) NOT NULL,
      beschreibung TEXT NULL,
      datum DATE NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX timeline_patient_datum_idx (patient_id, datum),
      CONSTRAINT timeline_patient_fk FOREIGN KEY (patient_id) REFERENCES customers(id) ON DELETE CASCADE,
      CONSTRAINT timeline_user_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
  },
  {
    tabelle: "loeschprotokoll",
    ddl: `CREATE TABLE IF NOT EXISTS loeschprotokoll (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patienten_nr VARCHAR(50) NULL,
      patient_kuerzel VARCHAR(20) NULL,
      umfang VARCHAR(255) NULL,
      grund VARCHAR(500) NULL,
      geloescht_von VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  // PraxiOS: Anamnesebögen
  {
    tabelle: "anamnesis_blocks",
    ddl: `CREATE TABLE IF NOT EXISTS anamnesis_blocks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      typ VARCHAR(30) NOT NULL,
      titel VARCHAR(255) NOT NULL,
      config TEXT NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    tabelle: "anamnesis_forms",
    ddl: `CREATE TABLE IF NOT EXISTS anamnesis_forms (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      titel VARCHAR(255) NOT NULL,
      beschreibung TEXT NULL,
      schema_json TEXT NOT NULL,
      aktiv TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    tabelle: "anamnesis_links",
    ddl: `CREATE TABLE IF NOT EXISTS anamnesis_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      form_id BIGINT UNSIGNED NOT NULL,
      patient_id BIGINT UNSIGNED NULL,
      token VARCHAR(64) NOT NULL,
      notiz VARCHAR(255) NULL,
      status ENUM('offen','eingereicht','abgelaufen') NOT NULL DEFAULT 'offen',
      laeuft_ab_am TIMESTAMP NOT NULL,
      eingereicht_am TIMESTAMP NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX anamnesis_links_token_unique (token),
      INDEX anamnesis_links_form_idx (form_id),
      CONSTRAINT links_form_fk FOREIGN KEY (form_id) REFERENCES anamnesis_forms(id) ON DELETE CASCADE,
      CONSTRAINT links_patient_fk FOREIGN KEY (patient_id) REFERENCES customers(id) ON DELETE SET NULL
    )`,
  },
  {
    tabelle: "anamnesis_submissions",
    ddl: `CREATE TABLE IF NOT EXISTS anamnesis_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      link_id BIGINT UNSIGNED NOT NULL,
      form_id BIGINT UNSIGNED NOT NULL,
      patient_id BIGINT UNSIGNED NOT NULL,
      daten TEXT NOT NULL,
      unterschrift_name VARCHAR(255) NOT NULL,
      datenschutz_zugestimmt TINYINT(1) NOT NULL DEFAULT 0,
      document_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX anamnesis_sub_patient_idx (patient_id),
      CONSTRAINT sub_link_fk FOREIGN KEY (link_id) REFERENCES anamnesis_links(id) ON DELETE CASCADE,
      CONSTRAINT sub_form_fk FOREIGN KEY (form_id) REFERENCES anamnesis_forms(id) ON DELETE CASCADE,
      CONSTRAINT sub_patient_fk FOREIGN KEY (patient_id) REFERENCES customers(id) ON DELETE CASCADE,
      CONSTRAINT sub_doc_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
    )`,
  },
];

const NEUE_INDIZES: { tabelle: string; index: string; ddl: string }[] = [
  { tabelle: "users", index: "users_username_unique", ddl: "ALTER TABLE users ADD UNIQUE INDEX users_username_unique (username)" },
  { tabelle: "customers", index: "customers_patienten_nr_unique", ddl: "ALTER TABLE customers ADD UNIQUE INDEX customers_patienten_nr_unique (patienten_nr)" },
];

export async function migriereFehlendeSpalten(): Promise<void> {
  const db = getDb();
  const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "").split("?")[0];

  for (const s of NEUE_SPALTEN) {
    const [rows] = (await db.execute(
      sql.raw(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='${s.tabelle}' AND COLUMN_NAME='${s.spalte}'`,
      ),
    )) as unknown as [{ n: number }[], unknown];
    if (Number(rows[0]?.n ?? 0) === 0) {
      console.log(`[migrate] + ${s.tabelle}.${s.spalte}`);
      await db.execute(sql.raw(s.ddl));
    }
  }

  for (const t of NEUE_TABELLEN) {
    const [rows] = (await db.execute(
      sql.raw(
        `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='${t.tabelle}'`,
      ),
    )) as unknown as [{ n: number }[], unknown];
    if (Number(rows[0]?.n ?? 0) === 0) {
      console.log(`[migrate] + Tabelle ${t.tabelle}`);
      await db.execute(sql.raw(t.ddl));
    }
  }

  for (const i of NEUE_INDIZES) {
    const [rows] = (await db.execute(
      sql.raw(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='${i.tabelle}' AND INDEX_NAME='${i.index}'`,
      ),
    )) as unknown as [{ n: number }[], unknown];
    if (Number(rows[0]?.n ?? 0) === 0) {
      console.log(`[migrate] + Index ${i.index}`);
      await db.execute(sql.raw(i.ddl));
    }
  }

  for (const a of SPALTEN_AENDERUNGEN) {
    const [rows] = (await db.execute(
      sql.raw(
        `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME='${a.tabelle}' AND COLUMN_NAME='${a.spalte}'`,
      ),
    )) as unknown as [{ t: string }[], unknown];
    const typ = rows[0]?.t ?? "";
    if (typ && !typ.includes(a.pruefWert)) {
      console.log(`[migrate] ~ ${a.tabelle}.${a.spalte}`);
      await db.execute(sql.raw(a.ddl));
    }
  }
}
