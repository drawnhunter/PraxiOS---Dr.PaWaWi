-- PraxisWerk (ReWaDo) - Datenbankschema (ohne Daten)
-- Fork von WAWIPROS, Stand:
-- Stand: 2026-07-23
SET FOREIGN_KEY_CHECKS=0;
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `bank_accounts`;
CREATE TABLE `bank_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bezeichnung` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kontoinhaber` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `iban` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bic` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ist_standard` tinyint(1) NOT NULL DEFAULT '0',
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;

DROP TABLE IF EXISTS `company_settings`;
CREATE TABLE `company_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `handelsregister` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `steuernummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ust_id_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `waehrung` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '€',
  `monats_budget` decimal(12,2) DEFAULT NULL,
  `waehrung` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '€',
  `monats_budget` decimal(12,2) DEFAULT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webseite` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `standard_zahlungsziel` int NOT NULL DEFAULT '14',
  `fuss_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `datev_beraternummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `datev_mandantennummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `datev_kontenrahmen` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SKR03',
  `erloeskonto_19` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '8400',
  `erloeskonto_7` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '8300',
  `erloeskonto_0` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '8120',
  `debitor_startnummer` int NOT NULL DEFAULT '10000',
  `kreditor_startnummer` int NOT NULL DEFAULT '70000',
  `aufwandskonto_default` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eori` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `betriebsnummer` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bg_mitgliedsnummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ihk` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `glaeubiger_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ics_token` varchar(48) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `akzentfarbe` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'neutral',
  `pdf_layout` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'klassisch',
  `age_recipient` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age_secret` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signatur_bild` mediumtext COLLATE utf8mb4_unicode_ci,
  `patienten_nr_start` int NOT NULL DEFAULT '1',
  `patienten_nr_prefix_aktiv` tinyint(1) NOT NULL DEFAULT '0',
  `patienten_nr_prefix` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'P',
  `backup_zuletzt_am` timestamp NULL DEFAULT NULL,
  `support_schluessel` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agent_autonomie` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vorschlag',
  `agent_pseudonym` tinyint(1) NOT NULL DEFAULT '1',
  `modul_konfig` text COLLATE utf8mb4_unicode_ci,
  `portal_aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `portal_bereiche` text COLLATE utf8mb4_unicode_ci,
  `erinnerung_aktiv` tinyint(1) NOT NULL DEFAULT '0',
  `erinnerung_tage_vorher` int NOT NULL DEFAULT '1',
  `kalender_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_port` int NOT NULL DEFAULT '587',
  `smtp_user` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_passwort_enc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_absender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30002;

DROP TABLE IF EXISTS `credit_note_items`;
CREATE TABLE `credit_note_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `credit_note_id` bigint unsigned NOT NULL,
  `position` int NOT NULL,
  `bezeichnung` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` decimal(10,3) NOT NULL DEFAULT '1',
  `einheit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stück',
  `einzelpreis` decimal(12,2) NOT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  `rabatt_art` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rabatt_wert` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`),
  KEY `credit_note_items_credit_idx` (`credit_note_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2030001;

DROP TABLE IF EXISTS `credit_notes`;
CREATE TABLE `credit_notes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('entwurf','finalisiert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
  `invoice_id` bigint unsigned NOT NULL,
  `datum` date NOT NULL,
  `grund` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_id` bigint unsigned DEFAULT NULL,
  `kunde_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kunde_strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `firmen_snapshot` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `netto` decimal(12,2) NOT NULL DEFAULT '0',
  `ust` decimal(12,2) NOT NULL DEFAULT '0',
  `brutto` decimal(12,2) NOT NULL DEFAULT '0',
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `credit_notes_nummer_unique` (`nummer`),
  UNIQUE KEY `id` (`id`),
  KEY `credit_notes_invoice_idx` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2030001;

DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geburtsdatum` date DEFAULT NULL,
  `patienten_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `krankenkasse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `versichertennummer` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aerztlicher_ansprechpartner` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `synonym` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ust_id_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zahlungsziel_tage` int DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `archiviert` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `debitornummer` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `customers_patienten_nr_unique` (`patienten_nr`),
  KEY `customers_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=4000001;

DROP TABLE IF EXISTS `delivery_note_items`;
CREATE TABLE `delivery_note_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_note_id` bigint unsigned NOT NULL,
  `position` int NOT NULL,
  `bezeichnung` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` decimal(10,3) NOT NULL DEFAULT '1',
  `einheit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stück',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `dn_items_dn_idx` (`delivery_note_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `delivery_notes`;
CREATE TABLE `delivery_notes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `typ` enum('standard','proforma') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standard',
  `status` enum('entwurf','finalisiert','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
  `abschlag_betrag` decimal(12,2) DEFAULT NULL,
  `proforma_von_id` bigint unsigned DEFAULT NULL,
  `therapieplan_id` bigint unsigned DEFAULT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `invoice_id` bigint unsigned DEFAULT NULL,
  `datum` date NOT NULL,
  `kunde_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kunde_strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `firmen_snapshot` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pdf_notiz` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `dn_customer_idx` (`customer_id`),
  KEY `dn_invoice_idx` (`invoice_id`),
  UNIQUE KEY `nummer` (`nummer`),
  UNIQUE KEY `delivery_notes_nummer_unique` (`nummer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `invoice_items`;
CREATE TABLE `invoice_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `position` int NOT NULL,
  `bezeichnung` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` decimal(10,3) NOT NULL DEFAULT '1',
  `einheit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stück',
  `einzelpreis` decimal(12,2) NOT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`),
  KEY `invoice_items_invoice_idx` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=6090001;

DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `typ` enum('standard','proforma') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standard',
  `status` enum('entwurf','finalisiert','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
  `abschlag_betrag` decimal(12,2) DEFAULT NULL,
  `proforma_von_id` bigint unsigned DEFAULT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `rechnungsdatum` date NOT NULL,
  `faelligkeitsdatum` date NOT NULL,
  `leistungsdatum` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_id` bigint unsigned DEFAULT NULL,
  `kunde_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kunde_strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `firmen_snapshot` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_snapshot` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `netto` decimal(12,2) NOT NULL DEFAULT '0',
  `ust` decimal(12,2) NOT NULL DEFAULT '0',
  `brutto` decimal(12,2) NOT NULL DEFAULT '0',
  `hauptrabatt_art` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hauptrabatt_wert` decimal(12,2) DEFAULT NULL,
  `rabatt_addieren` tinyint(1) NOT NULL DEFAULT '0',
  `bezahlt_betrag` decimal(12,2) NOT NULL DEFAULT '0',
  `bezahlt_am` date DEFAULT NULL,
  `bereits_bezahlt` tinyint(1) NOT NULL DEFAULT '0',
  `archiviert` tinyint(1) NOT NULL DEFAULT '0',
  `pdf_notiz` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `invoices_nummer_unique` (`nummer`),
  UNIQUE KEY `id` (`id`),
  KEY `invoices_status_idx` (`status`),
  KEY `invoices_datum_idx` (`rechnungsdatum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=6120001;

DROP TABLE IF EXISTS `konditionen`;
CREATE TABLE `konditionen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `typ` enum('kunde','lieferant') COLLATE utf8mb4_unicode_ci NOT NULL,
  `partner_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `preis_netto` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `konditionen_eindeutig` (`typ`,`partner_id`,`product_id`),
  KEY `konditionen_product_fk` (`product_id`),
  CONSTRAINT `konditionen_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `number_sequences`;
CREATE TABLE `number_sequences` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `typ` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jahr` int NOT NULL,
  `letzte_nummer` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uniq_typ_jahr` (`typ`,`jahr`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=8030001;

DROP TABLE IF EXISTS `offer_items`;
CREATE TABLE `offer_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `offer_id` bigint unsigned NOT NULL,
  `position` int NOT NULL,
  `bezeichnung` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` decimal(12,3) NOT NULL,
  `einheit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stück',
  `einzelpreis` decimal(12,2) NOT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `offer_items_offer_idx` (`offer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `offers`;
CREATE TABLE `offers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('entwurf','offen','bestaetigt','abgelehnt','umgewandelt','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
  `customer_id` bigint unsigned NOT NULL,
  `datum` date NOT NULL,
  `gueltig_bis` date DEFAULT NULL,
  `kunde_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kunde_strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kunde_land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `firmen_snapshot` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `netto` decimal(12,2) NOT NULL DEFAULT '0',
  `ust` decimal(12,2) NOT NULL DEFAULT '0',
  `brutto` decimal(12,2) NOT NULL DEFAULT '0',
  `pdf_notiz` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `converted_invoice_id` bigint unsigned DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `offers_status_idx` (`status`),
  UNIQUE KEY `nummer` (`nummer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `einheit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stück',
  `preis_netto` decimal(12,2) NOT NULL,
  `ek_preis_netto` decimal(12,2) DEFAULT NULL,
  `kategorie` enum('leistung','auslage') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'leistung',
  `import_namen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `artikelnummer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mindestbestand` decimal(12,2) DEFAULT NULL,
  `lager_aktiv` tinyint(1) NOT NULL DEFAULT '0',
  `goae_ziffer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goae_art` enum('direkt','analog','§2') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2030001;

DROP TABLE IF EXISTS `purchase_order_items`;
CREATE TABLE `purchase_order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `position` int NOT NULL,
  `bezeichnung` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` decimal(10,3) NOT NULL DEFAULT '1',
  `einheit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stück',
  `einzelpreis` decimal(12,2) NOT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `po_items_po_idx` (`purchase_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nummer` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('entwurf','bestellt','teilgeliefert','geliefert','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
  `supplier_id` bigint unsigned NOT NULL,
  `bestelldatum` date NOT NULL,
  `lieferdatum` date DEFAULT NULL,
  `lieferant_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lieferant_zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lieferant_strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lieferant_plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lieferant_ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lieferant_land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `firmen_snapshot` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pdf_notiz` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `netto` decimal(12,2) NOT NULL DEFAULT '0',
  `ust` decimal(12,2) NOT NULL DEFAULT '0',
  `brutto` decimal(12,2) NOT NULL DEFAULT '0',
  `bestellt_at` timestamp NULL DEFAULT NULL,
  `geliefert_am` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `po_status_idx` (`status`),
  KEY `po_supplier_idx` (`supplier_id`),
  UNIQUE KEY `nummer` (`nummer`),
  UNIQUE KEY `purchase_orders_nummer_unique` (`nummer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `reminders`;
CREATE TABLE `reminders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `stufe` int NOT NULL,
  `datum` date NOT NULL,
  `zahlungsfrist` date NOT NULL,
  `offen_betrag` decimal(12,2) NOT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `reminders_invoice_idx` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1121248;

DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `zusatz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strasse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plz` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ort` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `land` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Deutschland',
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ust_id_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `archiviert` tinyint(1) NOT NULL DEFAULT '0',
  `kategorie_id` bigint unsigned DEFAULT NULL,
  `synonym` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `suppliers_name_idx` (`name`),
  CONSTRAINT `suppliers_kategorie_fk` FOREIGN KEY (`kategorie_id`) REFERENCES `kategorien` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=2000001;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `unionId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passwordHash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `kalenderFarbe` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gruppe_id` bigint unsigned DEFAULT NULL,
  `mail_konto_ids` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignInAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `users_unionId_unique` (`unionId`),
  UNIQUE KEY `users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=8060001;

DROP TABLE IF EXISTS `invoice_therapie_wochen`;
CREATE TABLE `invoice_therapie_wochen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `jahr` int NOT NULL,
  `kw` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `therapie_woche_eindeutig` (`customer_id`,`jahr`,`kw`),
  KEY `therapie_woche_invoice_idx` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `therapy_imports`;
CREATE TABLE `therapy_imports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jahr` int NOT NULL,
  `sheets` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ergebnis` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `patient_contacts`;
CREATE TABLE `patient_contacts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `verhaeltnis` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ist_rechnungsempfaenger` tinyint(1) NOT NULL DEFAULT '0',
  `notiz` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `kontakte_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `therapy_plans`;
CREATE TABLE `therapy_plans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `von_datum` date NOT NULL,
  `bis_datum` date NOT NULL,
  `diagnose_ziele` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('geplant','aktiv','dokumentiert','abgerechnet') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'geplant',
  `rechnungsempfaenger_abweichend` tinyint(1) NOT NULL DEFAULT '0',
  `abweichender_empfaenger` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geloescht_am` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `therapy_plans_patient_idx` (`patient_id`),
  KEY `therapy_plans_status_idx` (`status`),
  CONSTRAINT `plans_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plans_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `plan_entries`;
CREATE TABLE `plan_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_id` bigint unsigned NOT NULL,
  `datum` date NOT NULL,
  `zeit_von` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zeit_bis` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leistung_id` bigint unsigned DEFAULT NULL,
  `leistung_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `menge` decimal(6,1) NOT NULL DEFAULT '1',
  `therapeut_id` bigint unsigned DEFAULT NULL,
  `raum` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reihenfolge` int NOT NULL DEFAULT '0',
  `status` enum('geplant','stattgefunden','abgesagt','ausgefallen') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'geplant',
  `bemerkung` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `plan_entries_datum_idx` (`datum`),
  KEY `plan_entries_plan_idx` (`plan_id`),
  CONSTRAINT `entries_plan_fk` FOREIGN KEY (`plan_id`) REFERENCES `therapy_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `entries_leistung_fk` FOREIGN KEY (`leistung_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `entries_therapeut_fk` FOREIGN KEY (`therapeut_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned DEFAULT NULL,
  `plan_id` bigint unsigned DEFAULT NULL,
  `kategorie` enum('befund','arztbrief','rezept','einverstaendnis','anamnesebogen','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sonstiges',
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dateipfad` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `groesse` int unsigned DEFAULT NULL,
  `notiz` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `documents_patient_idx` (`patient_id`),
  CONSTRAINT `docs_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `docs_plan_fk` FOREIGN KEY (`plan_id`) REFERENCES `therapy_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `docs_user_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `timeline_events`;
CREATE TABLE `timeline_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `typ` enum('plan','termin','dokument','notiz','status') COLLATE utf8mb4_unicode_ci NOT NULL,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `datum` date NOT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `timeline_patient_datum_idx` (`patient_id`,`datum`),
  CONSTRAINT `timeline_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `timeline_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `loeschprotokoll`;
CREATE TABLE `loeschprotokoll` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patienten_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_kuerzel` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `umfang` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grund` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geloescht_von` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `anamnesis_blocks`;
CREATE TABLE `anamnesis_blocks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `typ` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `anamnesis_forms`;
CREATE TABLE `anamnesis_forms` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `schema_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `anamnesis_links`;
CREATE TABLE `anamnesis_links` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `form_id` bigint unsigned NOT NULL,
  `patient_id` bigint unsigned DEFAULT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notiz` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('offen','eingereicht','abgelaufen') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'offen',
  `laeuft_ab_am` timestamp NOT NULL,
  `eingereicht_am` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `anamnesis_links_token_unique` (`token`),
  KEY `anamnesis_links_form_idx` (`form_id`),
  CONSTRAINT `links_form_fk` FOREIGN KEY (`form_id`) REFERENCES `anamnesis_forms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `links_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `anamnesis_submissions`;
CREATE TABLE `anamnesis_submissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `link_id` bigint unsigned NOT NULL,
  `form_id` bigint unsigned NOT NULL,
  `patient_id` bigint unsigned NOT NULL,
  `sprache` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'de',
  `daten` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `daten_de` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unterschrift_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `datenschutz_zugestimmt` tinyint(1) NOT NULL DEFAULT '0',
  `document_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `anamnesis_sub_patient_idx` (`patient_id`),
  CONSTRAINT `sub_link_fk` FOREIGN KEY (`link_id`) REFERENCES `anamnesis_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sub_form_fk` FOREIGN KEY (`form_id`) REFERENCES `anamnesis_forms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sub_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sub_doc_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `kollegen`;
CREATE TABLE `kollegen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `age_recipient` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notiz` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `akten_exporte`;
CREATE TABLE `akten_exporte` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `kollege_id` bigint unsigned NOT NULL,
  `einverstaendnis_doc_id` bigint unsigned DEFAULT NULL,
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `umfang` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `gruppen`;
CREATE TABLE `gruppen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rechte` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `mail_log`;
CREATE TABLE `mail_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `beleg_art` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beleg_id` bigint unsigned NOT NULL,
  `empfaenger` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `betreff` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `erfolg` tinyint(1) NOT NULL,
  `fehler` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gesendet_am` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `incoming_invoices`;
CREATE TABLE `incoming_invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lieferant_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lieferant_kennung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nummer` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rechnungsdatum` date NOT NULL,
  `faelligkeitsdatum` date DEFAULT NULL,
  `netto` decimal(12,2) NOT NULL,
  `ust` decimal(12,2) NOT NULL,
  `brutto` decimal(12,2) NOT NULL,
  `waehrung` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EUR',
  `konto` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gegenkonto` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bezahlt_am` date DEFAULT NULL,
  `positionen_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_xml` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kategorie_id` bigint unsigned DEFAULT NULL,
  `beleg_base64` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `beleg_mime` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `incoming_eindeutig` (`lieferant_name`,`nummer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `lager_bewegungen`;
CREATE TABLE `lager_bewegungen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `typ` enum('zugang','abgang','korrektur','inventur') COLLATE utf8mb4_unicode_ci NOT NULL,
  `menge` decimal(12,2) NOT NULL,
  `datum` date NOT NULL,
  `bemerkung` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `lager_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `invoice_series`;
CREATE TABLE `invoice_series` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint unsigned NOT NULL,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `intervall_tage` int NOT NULL DEFAULT '30',
  `naechste_faellig` date NOT NULL,
  `items_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `bemerkung` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `series_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `translation_cache`;
CREATE TABLE `translation_cache` (
  `hash` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quelle` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ziel_sprache` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ziel` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `termin_erinnerungen`;
CREATE TABLE `termin_erinnerungen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entry_id` bigint unsigned NOT NULL,
  `gesendet_an` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gesendet_am` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `termin_erinnerung_eindeutig` (`entry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `kontenrahmen`;
CREATE TABLE `kontenrahmen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `rahmen` enum('SKR03','SKR04') COLLATE utf8mb4_unicode_ci NOT NULL,
  `konto` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bezeichnung` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `klasse` int NOT NULL,
  `gruppe` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kontenrahmen_eindeutig` (`rahmen`,`konto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `kategorien`;
CREATE TABLE `kategorien` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `konto` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  `sortierung` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `email_konten`;
CREATE TABLE `email_konten` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int NOT NULL DEFAULT '993',
  `tls` tinyint(1) NOT NULL DEFAULT '1',
  `benutzer` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwort_enc` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ordner` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INBOX',
  `ordner_liste` text COLLATE utf8mb4_unicode_ci,
  `smtp_host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_port` int DEFAULT NULL,
  `smtp_benutzer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_passwort_enc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `smtp_absender` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `route` enum('rechnung','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rechnung',
  `intervall_minuten` int NOT NULL DEFAULT '10',
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `letzter_abruf` timestamp NULL DEFAULT NULL,
  `letzter_fehler` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mail_mails` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `konto_id` bigint unsigned NOT NULL,
  `ordner` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INBOX',
  `uid` bigint unsigned NOT NULL,
  `message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `betreff` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `absender_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `absender_adresse` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `empfaenger` text COLLATE utf8mb4_unicode_ci,
  `datum` timestamp NULL DEFAULT NULL,
  `text_plain` text COLLATE utf8mb4_unicode_ci,
  `text_html` text COLLATE utf8mb4_unicode_ci,
  `anhaenge` text COLLATE utf8mb4_unicode_ci,
  `gelesen` tinyint(1) NOT NULL DEFAULT '0',
  `markiert` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mail_eindeutig` (`konto_id`,`ordner`,`uid`),
  KEY `mail_datum_idx` (`datum`),
  CONSTRAINT `mail_mails_konto_fk` FOREIGN KEY (`konto_id`) REFERENCES `email_konten` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mail_regeln` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pattern` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `feld` enum('absender','betreff') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'absender',
  `post_typ` enum('rechnung','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rechnung',
  `kategorie_id` bigint unsigned DEFAULT NULL,
  `prio` int NOT NULL DEFAULT '10',
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mail_entwuerfe` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `empfaenger` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bcc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `konto_id` bigint unsigned DEFAULT NULL,
  `betreff` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `text` text COLLATE utf8mb4_unicode_ci,
  `anhaenge` text COLLATE utf8mb4_unicode_ci,
  `in_reply_to` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referenzen` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quelle` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mensch',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kontakte` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefon` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firma` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notiz` text COLLATE utf8mb4_unicode_ci,
  `quelle` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manuell',
  `erstellt_von` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mensch',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kontakte_email_uniq` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `post_eingang`;
CREATE TABLE `post_eingang` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `typ` enum('rechnung','lieferschein','gutschrift','sonstiges') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rechnung',
  `status` enum('neu','gebucht','abgelegt') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'neu',
  `originalname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `groesse` int NOT NULL,
  `datei_inhalt` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `absender_lieferant_id` bigint unsigned DEFAULT NULL,
  `absender_freitext` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stichwort` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rechnungsnummer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `betrag` decimal(12,2) DEFAULT NULL,
  `ust_satz` int NOT NULL DEFAULT '19',
  `rechnungsdatum` date DEFAULT NULL,
  `faellig_am` date DEFAULT NULL,
  `wiedervorlage_am` date DEFAULT NULL,
  `konto` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gegenkonto` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kategorie_id` bigint unsigned DEFAULT NULL,
  `quelle` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'upload',
  `notizen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incoming_invoice_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `pe_lieferant_fk` FOREIGN KEY (`absender_lieferant_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pe_kategorie_fk` FOREIGN KEY (`kategorie_id`) REFERENCES `kategorien` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pe_invoice_fk` FOREIGN KEY (`incoming_invoice_id`) REFERENCES `incoming_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE `rezepte` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned DEFAULT NULL,
  `typ` enum('rezept','attest','praxisbedarf') COLLATE utf8mb4_unicode_ci NOT NULL,
  `inhalt` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_id` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `rezepte_patient_idx` (`patient_id`),
  CONSTRAINT `rezepte_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rezepte_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rezepte_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `protokoll_vorlagen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beschreibung` text COLLATE utf8mb4_unicode_ci,
  `schema_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `pv_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `protokolle` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `vorlage_id` bigint unsigned DEFAULT NULL,
  `titel` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schema_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `nachtraege` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `protokolle_patient_idx` (`patient_id`),
  CONSTRAINT `protokolle_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `protokolle_vorlage_fk` FOREIGN KEY (`vorlage_id`) REFERENCES `protokoll_vorlagen` (`id`) ON DELETE SET NULL,
  CONSTRAINT `protokolle_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `company_kennwerte` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wert` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `post_eingang_id` bigint unsigned DEFAULT NULL,
  `sortierung` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `ck_post_fk` FOREIGN KEY (`post_eingang_id`) REFERENCES `post_eingang` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `bank_importe` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bank_account_id` bigint unsigned NOT NULL,
  `dateiname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vorlage` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Bank-CSV',
  `zeilen` int NOT NULL DEFAULT '0',
  `duplikate` int NOT NULL DEFAULT '0',
  `summe_ein` decimal(14,2) NOT NULL DEFAULT '0.00',
  `summe_aus` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `bank_importe_konto_fk` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bank_transaktionen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bank_account_id` bigint unsigned NOT NULL,
  `import_id` bigint unsigned DEFAULT NULL,
  `datum` date NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `zweck` text COLLATE utf8mb4_unicode_ci,
  `betrag` decimal(14,2) NOT NULL,
  `gebuehr` decimal(12,2) DEFAULT NULL,
  `saldo_nach` decimal(14,2) DEFAULT NULL,
  `hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quell_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('offen','zugeordnet','ignoriert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'offen',
  `invoice_id` bigint unsigned DEFAULT NULL,
  `incoming_invoice_id` bigint unsigned DEFAULT NULL,
  `zugeordneter_betrag` decimal(14,2) DEFAULT NULL,
  `zugeordnet_am` timestamp NULL DEFAULT NULL,
  `bemerkung` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bank_tx_hash_uniq` (`bank_account_id`,`hash`),
  KEY `bank_tx_quell_idx` (`quell_id`),
  KEY `bank_tx_konto_datum` (`bank_account_id`,`datum`),
  KEY `bank_tx_status` (`status`),
  CONSTRAINT `bank_tx_konto_fk` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bank_tx_import_fk` FOREIGN KEY (`import_id`) REFERENCES `bank_importe` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bank_tx_invoice_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bank_tx_incoming_fk` FOREIGN KEY (`incoming_invoice_id`) REFERENCES `incoming_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `support_meldungen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `typ` enum('frage','problem','idee','fehler') COLLATE utf8mb4_unicode_ci NOT NULL,
  `betreff` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nachricht` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `kontext` text COLLATE utf8mb4_unicode_ci,
  `benutzer` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instanz` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('gesendet','fehlgeschlagen') COLLATE utf8mb4_unicode_ci NOT NULL,
  `fehler` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `agent_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `freigabe_empfaenger` text COLLATE utf8mb4_unicode_ci,
  `letzte_nutzung` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `agent_aufgaben` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `text` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `erledigt` tinyint(1) NOT NULL DEFAULT '0',
  `erledigt_am` timestamp NULL DEFAULT NULL,
  `faellig_am` date DEFAULT NULL,
  `prioritaet` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `referenz_json` text COLLATE utf8mb4_unicode_ci,
  `quelle` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mensch',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `agent_idempotenz` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `schluessel` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpunkt` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` int NOT NULL,
  `antwort_json` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `webhooks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ereignis` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aktiv` tinyint(1) NOT NULL DEFAULT '1',
  `fehler` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `agent_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `aktion` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `patient_portal_links` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `token` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gueltig_bis` date NOT NULL,
  `fehlversuche` int NOT NULL DEFAULT '0',
  `gesperrt_bis` timestamp NULL DEFAULT NULL,
  `letzter_zugriff_am` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ppl_token_uniq` (`token`),
  CONSTRAINT `ppl_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ppl_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patient_portal_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `link_id` bigint unsigned NOT NULL,
  `patient_id` bigint unsigned NOT NULL,
  `token` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gueltig_bis` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pps_token_uniq` (`token`),
  KEY `pps_patient_idx` (`patient_id`),
  CONSTRAINT `pps_link_fk` FOREIGN KEY (`link_id`) REFERENCES `patient_portal_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pps_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patient_portal_zugriffe` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `bereich` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `zeitpunkt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ppz_patient_idx` (`patient_id`),
  CONSTRAINT `ppz_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patient_daten_antraege` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `felder` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('offen','bestaetigt','abgelehnt') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'offen',
  `kommentar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bearbeitet_am` timestamp NULL DEFAULT NULL,
  `bearbeitet_von` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `pda_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pda_user_fk` FOREIGN KEY (`bearbeitet_von`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `termin_anfragen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `wunsch_datum` date NOT NULL,
  `wunsch_von` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wunsch_bis` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notiz` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('offen','bestaetigt','abgelehnt') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'offen',
  `praxis_kommentar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bearbeitet_am` timestamp NULL DEFAULT NULL,
  `bearbeitet_von` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `ta_patient_fk` FOREIGN KEY (`patient_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ta_user_fk` FOREIGN KEY (`bearbeitet_von`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
