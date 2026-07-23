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
];

const NEUE_INDIZES: { tabelle: string; index: string; ddl: string }[] = [
  { tabelle: "users", index: "users_username_unique", ddl: "ALTER TABLE users ADD UNIQUE INDEX users_username_unique (username)" },
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
}
