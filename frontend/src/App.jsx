import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Registration from "./pages/Registration.jsx";
import RegistrationSuccess from "./pages/RegistrationSuccess.jsx";
import RegistrationError from "./pages/RegistrationError.jsx";
import AdminApp from "./pages/admin/AdminApp.jsx";
import ForgotPassword from "./pages/admin/ForgotPassword.jsx";
import ResetPassword from "./pages/admin/ResetPassword.jsx";
import useHorizontalDragScroll from "./hooks/useHorizontalDragScroll.js";
import { readProjectRef } from "./hooks/useProjectRef.js";

export default function App() {
  useHorizontalDragScroll();

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/register/success" element={<RegistrationSuccess />} />
      <Route path="/register/error" element={<RegistrationError />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function RootRoute() {
  const [searchParams] = useSearchParams();
  const projectRef = readProjectRef(searchParams);

  // Published event links use an opaque, keyless query token.
  // The bare base URL is now the software login entry point.
  return projectRef ? <Landing /> : <Navigate to="/admin" replace />;
}
