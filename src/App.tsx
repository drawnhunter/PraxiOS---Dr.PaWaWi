import { Routes, Route } from "react-router";
import Layout from "@/components/Layout";
import TherapyImport from "@/pages/TherapyImport";
import Dashboard from "@/pages/Dashboard";
import Statistics from "@/pages/Statistics";
import BankImport from "@/pages/BankImport";
import InvoiceImport from "@/pages/InvoiceImport";
import Invoices from "@/pages/Invoices";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Offers from "@/pages/Offers";
import OfferDetail from "@/pages/OfferDetail";
import CreditNotes from "@/pages/CreditNotes";
import CreditNoteDetail from "@/pages/CreditNoteDetail";
import DeliveryNotes from "@/pages/DeliveryNotes";
import DeliveryNoteDetail from "@/pages/DeliveryNoteDetail";
import PurchaseOrders from "@/pages/PurchaseOrders";
import PurchaseOrderDetail from "@/pages/PurchaseOrderDetail";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Products from "@/pages/Products";
import SettingsPage from "@/pages/Settings";
import Login from "./pages/Login"
import NotFound from "./pages/NotFound"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<TherapyImport />} />
        <Route path="/uebersicht" element={<Dashboard />} />
        <Route path="/statistik" element={<Statistics />} />
        <Route path="/bank" element={<BankImport />} />
        <Route path="/rechnungen/importieren" element={<InvoiceImport />} />
        <Route path="/angebote" element={<Offers />} />
        <Route path="/angebote/:id" element={<OfferDetail />} />
        <Route path="/rechnungen" element={<Invoices />} />
        <Route path="/rechnungen/:id" element={<InvoiceDetail />} />
        <Route path="/gutschriften" element={<CreditNotes />} />
        <Route path="/gutschriften/:id" element={<CreditNoteDetail />} />
        <Route path="/lieferscheine" element={<DeliveryNotes />} />
        <Route path="/lieferscheine/:id" element={<DeliveryNoteDetail />} />
        <Route path="/bestellungen" element={<PurchaseOrders />} />
        <Route path="/bestellungen/:id" element={<PurchaseOrderDetail />} />
        <Route path="/kunden" element={<Customers />} />
        <Route path="/lieferanten" element={<Suppliers />} />
        <Route path="/produkte" element={<Products />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
