import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loading } from "@/components/common/states";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth, RequireRole } from "@/components/common/RequireAuth";
import { AuthPage } from "@/pages/auth/AuthPage";
import { NotFound } from "@/pages/NotFound";
const Dashboard = lazy(() => import("@/pages/farmer/Dashboard").then((m) => ({ default: m.Dashboard })));
import { CropsPage } from "@/pages/farmer/Crops";
import { WeatherPage } from "@/pages/farmer/Weather";
import { DiseasePage } from "@/pages/farmer/Disease";
import { FertilizerPage } from "@/pages/farmer/Fertilizer";
import { MarketPage } from "@/pages/farmer/Market";
import { SchedulePage } from "@/pages/farmer/Schedule";
import { NotificationsPage } from "@/pages/farmer/Notifications";
import { ProfilePage } from "@/pages/farmer/Profile";
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const FarmersPage = lazy(() => import("@/pages/admin/Farmers").then((m) => ({ default: m.FarmersPage })));
const RecordsPage = lazy(() => import("@/pages/admin/Records").then((m) => ({ default: m.RecordsPage })));
const ReportsPage = lazy(() => import("@/pages/admin/Reports").then((m) => ({ default: m.ReportsPage })));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/admin/login" element={<AuthPage admin />} />
      <Route path="/admin/register" element={<Navigate to="/admin/login" replace />} />

      {/* Signed-in area (sidebar + top bar) */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route element={<RequireRole role="farmer" />}>
            <Route index element={<Dashboard />} />
            <Route path="/crops" element={<CropsPage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/disease" element={<DiseasePage />} />
            <Route path="/fertilizer" element={<FertilizerPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
          </Route>

          <Route path="/admin" element={<RequireRole role="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="farmers" element={<FarmersPage />} />
            <Route path="crops" element={<RecordsPage />} />
            <Route path="market" element={<MarketPage admin />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
