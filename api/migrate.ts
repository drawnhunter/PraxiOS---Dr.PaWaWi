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
  // PraxiOS: Austausch (age)
  { tabelle: "company_settings", spalte: "age_recipient", ddl: "ALTER TABLE company_settings ADD COLUMN age_recipient VARCHAR(100) NULL AFTER pdf_layout" },
  { tabelle: "company_settings", spalte: "age_secret", ddl: "ALTER TABLE company_settings ADD COLUMN age_secret VARCHAR(100) NULL AFTER age_recipient" },
  { tabelle: "company_settings", spalte: "kalender_token", ddl: "ALTER TABLE company_settings ADD COLUMN kalender_token VARCHAR(64) NULL AFTER age_secret" },
  // PraxiOS: Rollen
  { tabelle: "users", spalte: "gruppe_id", ddl: "ALTER TABLE users ADD COLUMN gruppe_id BIGINT UNSIGNED NULL AFTER kalenderFarbe" },
  // WAWIPROS 1.0-Port: SMTP + Lager
  { tabelle: "company_settings", spalte: "smtp_host", ddl: "ALTER TABLE company_settings ADD COLUMN smtp_host VARCHAR(255) NULL AFTER kalender_token" },
  { tabelle: "company_settings", spalte: "smtp_port", ddl: "ALTER TABLE company_settings ADD COLUMN smtp_port INT NOT NULL DEFAULT 587 AFTER smtp_host" },
  { tabelle: "company_settings", spalte: "smtp_user", ddl: "ALTER TABLE company_settings ADD COLUMN smtp_user VARCHAR(255) NULL AFTER smtp_port" },
  { tabelle: "company_settings", spalte: "smtp_passwort_enc", ddl: "ALTER TABLE company_settings ADD COLUMN smtp_passwort_enc VARCHAR(500) NULL AFTER smtp_user" },
  { tabelle: "company_settings", spalte: "smtp_absender", ddl: "ALTER TABLE company_settings ADD COLUMN smtp_absender VARCHAR(255) NULL AFTER smtp_passwort_enc" },
  { tabelle: "products", spalte: "artikelnummer", ddl: "ALTER TABLE products ADD COLUMN artikelnummer VARCHAR(100) NULL AFTER import_namen" },
  { tabelle: "products", spalte: "barcode", ddl: "ALTER TABLE products ADD COLUMN barcode VARCHAR(100) NULL AFTER artikelnummer" },
  { tabelle: "products", spalte: "mindestbestand", ddl: "ALTER TABLE products ADD COLUMN mindestbestand DECIMAL(12,2) NULL AFTER barcode" },
  { tabelle: "products", spalte: "lager_aktiv", ddl: "ALTER TABLE products ADD COLUMN lager_aktiv TINYINT(1) NOT NULL DEFAULT 0 AFTER mindestbestand" },
  // 1.1.0: Papierkorb Therapiepläne
  { tabelle: "therapy_plans", spalte: "geloescht_am", ddl: "ALTER TABLE therapy_plans ADD COLUMN geloescht_am TIMESTAMP NULL AFTER notizen" },
  // 1.1.1: GOÄ-Mapping am Produkt
  { tabelle: "products", spalte: "goae_ziffer", ddl: "ALTER TABLE products ADD COLUMN goae_ziffer VARCHAR(20) NULL AFTER lager_aktiv" },
  { tabelle: "products", spalte: "goae_art", ddl: "ALTER TABLE products ADD COLUMN goae_art ENUM('direkt','analog','§2') NULL AFTER goae_ziffer" },
  // 1.1.1: GOÄ-Mapping am Produkt
  { tabelle: "products", spalte: "goae_ziffer", ddl: "ALTER TABLE products ADD COLUMN goae_ziffer VARCHAR(20) NULL AFTER lager_aktiv" },
  { tabelle: "products", spalte: "goae_art", ddl: "ALTER TABLE products ADD COLUMN goae_art ENUM('direkt','analog','§2') NULL AFTER goae_ziffer" },
  // 1.1.1: Terminerinnerungen
  { tabelle: "company_settings", spalte: "erinnerung_aktiv", ddl: "ALTER TABLE company_settings ADD COLUMN erinnerung_aktiv TINYINT(1) NOT NULL DEFAULT 0 AFTER kalender_token" },
  { tabelle: "company_settings", spalte: "erinnerung_tage_vorher", ddl: "ALTER TABLE company_settings ADD COLUMN erinnerung_tage_vorher INT NOT NULL DEFAULT 1 AFTER erinnerung_aktiv" },
  // 1.1.0: Mehrsprachige Bögen
  { tabelle: "anamnesis_submissions", spalte: "sprache", ddl: "ALTER TABLE anamnesis_submissions ADD COLUMN sprache VARCHAR(8) NOT NULL DEFAULT 'de' AFTER patient_id" },
  { tabelle: "anamnesis_submissions", spalte: "daten_de", ddl: "ALTER TABLE anamnesis_submissions ADD COLUMN daten_de TEXT NULL AFTER daten" },
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
  // PraxiOS: Rollen
  {
    tabelle: "gruppen",
    ddl: `CREATE TABLE IF NOT EXISTS gruppen (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      rechte TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  // WAWIPROS 1.0-Port
  {
    tabelle: "mail_log",
    ddl: `CREATE TABLE IF NOT EXISTS mail_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      beleg_art VARCHAR(30) NOT NULL,
      beleg_id BIGINT UNSIGNED NOT NULL,
      empfaenger VARCHAR(320) NOT NULL,
      betreff VARCHAR(500) NOT NULL,
      erfolg TINYINT(1) NOT NULL,
      fehler TEXT NULL,
      gesendet_am TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    tabelle: "incoming_invoices",
    ddl: `CREATE TABLE IF NOT EXISTS incoming_invoices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      lieferant_name VARCHAR(255) NOT NULL,
      lieferant_kennung VARCHAR(255) NULL,
      nummer VARCHAR(100) NOT NULL,
      rechnungsdatum DATE NOT NULL,
      faelligkeitsdatum DATE NULL,
      netto DECIMAL(12,2) NOT NULL,
      ust DECIMAL(12,2) NOT NULL,
      brutto DECIMAL(12,2) NOT NULL,
      waehrung VARCHAR(10) NOT NULL DEFAULT 'EUR',
      bezahlt_am DATE NULL,
      positionen_json TEXT NULL,
      original_xml TEXT NULL,
      bemerkung TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX incoming_eindeutig (lieferant_name, nummer)
    )`,
  },
  {
    tabelle: "lager_bewegungen",
    ddl: `CREATE TABLE IF NOT EXISTS lager_bewegungen (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      product_id BIGINT UNSIGNED NOT NULL,
      typ ENUM('zugang','abgang','korrektur','inventur') NOT NULL,
      menge DECIMAL(12,2) NOT NULL,
      datum DATE NOT NULL,
      bemerkung VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT lager_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
  },
  {
    tabelle: "invoice_series",
    ddl: `CREATE TABLE IF NOT EXISTS invoice_series (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_id BIGINT UNSIGNED NOT NULL,
      titel VARCHAR(255) NOT NULL,
      intervall_tage INT NOT NULL DEFAULT 30,
      naechste_faellig DATE NOT NULL,
      items_json TEXT NOT NULL,
      bemerkung TEXT NULL,
      aktiv TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT series_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
  },
  // 1.1.1: Terminerinnerungen
  {
    tabelle: "termin_erinnerungen",
    ddl: `CREATE TABLE IF NOT EXISTS termin_erinnerungen (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      entry_id BIGINT UNSIGNED NOT NULL,
      gesendet_an VARCHAR(320) NOT NULL,
      gesendet_am TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX termin_erinnerung_eindeutig (entry_id)
    )`,
  },
  // 1.1.0: Übersetzungs-Cache
  {
    tabelle: "translation_cache",
    ddl: `CREATE TABLE IF NOT EXISTS translation_cache (
      hash VARCHAR(32) NOT NULL PRIMARY KEY,
      quelle TEXT NOT NULL,
      ziel_sprache VARCHAR(8) NOT NULL,
      ziel TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  // PraxiOS: Austausch
  {
    tabelle: "kollegen",
    ddl: `CREATE TABLE IF NOT EXISTS kollegen (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      age_recipient VARCHAR(100) NOT NULL,
      notiz VARCHAR(500) NULL,
      aktiv TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    tabelle: "akten_exporte",
    ddl: `CREATE TABLE IF NOT EXISTS akten_exporte (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      kollege_id BIGINT UNSIGNED NOT NULL,
      einverstaendnis_doc_id BIGINT UNSIGNED NULL,
      dateiname VARCHAR(255) NOT NULL,
      umfang VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
