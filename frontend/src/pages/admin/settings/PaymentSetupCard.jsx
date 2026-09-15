// frontend/src/pages/admin/settings/PaymentSetupCard.jsx
import CredentialCategoryCard from "./CredentialCategoryCard.jsx";

const FIELDS = [
  { key: "payment_gateway_key", label: "Payment Gateway Key", is_secret: true },
  { key: "payment_gateway_secret", label: "Payment Gateway Secret", is_secret: true },
  { key: "payment_merchant_id", label: "Merchant ID", is_secret: false },
];

export default function PaymentSetupCard({ onBack, onLoggedOut }) {
  return <CredentialCategoryCard title="Payment Setup" category="payment" fields={FIELDS} onBack={onBack} onLoggedOut={onLoggedOut} />;
}