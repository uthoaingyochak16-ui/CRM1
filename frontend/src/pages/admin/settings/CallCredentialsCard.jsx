// frontend/src/pages/admin/settings/CallCredentialsCard.jsx
import CredentialCategoryCard from "./CredentialCategoryCard.jsx";

const FIELDS = [
  { key: "call_account_sid", label: "Account SID", is_secret: false },
  { key: "call_auth_token", label: "Auth Token", is_secret: true },
  { key: "call_api_key", label: "API Key", is_secret: true },
];

export default function CallCredentialsCard({ onBack, onLoggedOut }) {
  return <CredentialCategoryCard title="Direct Call Credentials Setup" category="call" fields={FIELDS} onBack={onBack} onLoggedOut={onLoggedOut} />;
}