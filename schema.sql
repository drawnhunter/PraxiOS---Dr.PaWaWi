-- ReWaKi - Datenbankschema (ohne Daten)
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
  `akzentfarbe` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'neutral',
  `pdf_layout` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'klassisch',
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
  `ust_id_nr` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zahlungsziel_tage` int DEFAULT NULL,
  `notizen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `archiviert` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `debitornummer` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `id` (`id`),
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
  `status` enum('entwurf','finalisiert','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
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
  `status` enum('entwurf','finalisiert','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
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
  `bezahlt_betrag` decimal(12,2) NOT NULL DEFAULT '0',
  `bezahlt_am` date DEFAULT NULL,
  `bereits_bezahlt` tinyint(1) NOT NULL DEFAULT '0',
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
  `status` enum('entwurf','finalisiert','umgewandelt','storniert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'entwurf',
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
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `suppliers_name_idx` (`name`)
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

SET FOREIGN_KEY_CHECKS=1;
