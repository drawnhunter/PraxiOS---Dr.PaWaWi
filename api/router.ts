import { createRouter, publicQuery } from "./middleware";
import { settingsRouter } from "./settingsRouter";
import { bankRouter } from "./bankRouter";
import { customerRouter } from "./customerRouter";
import { productRouter } from "./productRouter";
import { invoiceRouter } from "./invoiceRouter";
import { creditNoteRouter } from "./creditNoteRouter";
import { dashboardRouter } from "./dashboardRouter";
import { importRouter } from "./importRouter";
import { supplierRouter } from "./supplierRouter";
import { purchaseOrderRouter } from "./purchaseOrderRouter";
import { deliveryNoteRouter } from "./deliveryNoteRouter";
import { pdfRouter } from "./pdfRouter";
import { exportRouter } from "./exportRouter";
import { reminderRouter } from "./reminderRouter";
import { offerRouter } from "./offerRouter";
import { authRouter } from "./auth-router";
import { statsRouter } from "./statsRouter";
import { bankImportRouter } from "./bankImportRouter";
import { invoiceImportRouter } from "./invoiceImportRouter";
import { therapyImportRouter } from "./therapyImportRouter";
import { planRouter } from "./planRouter";
import { calendarRouter } from "./calendarRouter";
import { documentRouter } from "./documentRouter";
import { anamneseRouter } from "./anamneseRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  settings: settingsRouter,
  bank: bankRouter,
  customers: customerRouter,
  products: productRouter,
  invoices: invoiceRouter,
  creditNotes: creditNoteRouter,
  dashboard: dashboardRouter,
  import: importRouter,
  suppliers: supplierRouter,
  purchaseOrders: purchaseOrderRouter,
  deliveryNotes: deliveryNoteRouter,
  pdf: pdfRouter,
  export: exportRouter,
  reminders: reminderRouter,
  offers: offerRouter,
  stats: statsRouter,
  bankImport: bankImportRouter,
  invoiceImport: invoiceImportRouter,
  therapyImport: therapyImportRouter,
  // PraxisWerk-Akte
  plaene: planRouter,
  kalender: calendarRouter,
  dokumente: documentRouter,
  anamnese: anamneseRouter,
  leistungen: productRouter, // Alias für Akte-Seiten (gleicher Katalog)
});

export type AppRouter = typeof appRouter;
