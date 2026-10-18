import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/api/types";
import { Loading } from "./states";

export const homeFor = (role: Role) => (role === "admin" ? "/admin" : "/");

/** Layout route: any signed-in user. Sends visitors to the right sign-in page otherwise. */
export function RequireAuth() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label={t("auth.restoring")} />;
  if (!user) {
    const to = location.pathname.startsWith("/admin") ? "/admin/login" : "/login";
    return <Navigate to={to} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Layout route: only the given role; everyone else goes to their own home. */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
