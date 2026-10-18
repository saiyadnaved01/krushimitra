import { useEffect, useState, type ComponentType } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sprout,
  LayoutDashboard,
  CloudSun,
  ScanLine,
  FlaskConical,
  TrendingUp,
  CalendarDays,
  Bell,
  UserRound,
  ChevronDown,
  ChevronRight,
  MapPin,
  Menu,
  Headset,
  ShieldCheck,
  LogOut,
  UsersRound,
  ClipboardList,
  ChartNoAxesCombined,
  Leaf,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/api/hooks";
import { initials } from "@/lib/format";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { Brand } from "./Brand";

interface NavEntry {
  to: string;
  label: string; // translation key
  icon: ComponentType<{ className?: string }>;
}

const farmerNav: NavEntry[] = [
  { to: "/", label: "nav.dashboard", icon: LayoutDashboard },
  { to: "/crops", label: "nav.crops", icon: Sprout },
  { to: "/weather", label: "nav.weather", icon: CloudSun },
  { to: "/disease", label: "nav.disease", icon: ScanLine },
  { to: "/fertilizer", label: "nav.fertilizer", icon: FlaskConical },
  { to: "/market", label: "nav.market", icon: TrendingUp },
  { to: "/schedule", label: "nav.schedule", icon: CalendarDays },
];

const adminNav: NavEntry[] = [
  { to: "/admin", label: "nav.adminAnalytics", icon: ChartNoAxesCombined },
  { to: "/admin/farmers", label: "nav.adminFarmers", icon: UsersRound },
  { to: "/admin/crops", label: "nav.adminRecords", icon: ClipboardList },
  { to: "/admin/market", label: "nav.adminMarket", icon: TrendingUp },
  { to: "/admin/reports", label: "nav.adminReports", icon: ChartNoAxesCombined },
];

const sharedTitles: Record<string, string> = {
  "/notifications": "nav.notifications",
  "/profile": "nav.profile",
};

function NavItem({
  to,
  children,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className="nav-item"
      data-status={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer and jump to the top whenever the page changes.
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!user) return null;
  const admin = user.role === "admin";
  const nav = admin ? adminNav : farmerNav;
  const unread = notifications.data?.unread ?? 0;
  const current = t(
    nav.find((n) => n.to === pathname)?.label ?? sharedTitles[pathname] ?? (admin ? "nav.admin" : "nav.dashboard"),
  );

  const signOut = () => {
    const to = admin ? "/admin/login" : "/login";
    logout();
    navigate(to, { replace: true });
  };

  return (
    <>
      {open && <div className="mobile-shade" onClick={() => setOpen(false)} />}
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <Brand />
        <div className="nav-group">
          <div className="nav-label">{t(admin ? "nav.workspaceAdmin" : "nav.workspaceFarmer")}</div>
          {nav.map((n) => (
            <NavItem key={n.to} to={n.to} onClick={() => setOpen(false)}>
              <n.icon />
              {t(n.label)}
            </NavItem>
          ))}
        </div>
        <div className="nav-group border-t">
          <div className="nav-label">{t("nav.account")}</div>
          <NavItem to="/notifications" onClick={() => setOpen(false)}>
            <Bell />
            {t("nav.notifications")}
            <span className="ml-auto tag">{unread}</span>
          </NavItem>
          <NavItem to="/profile" onClick={() => setOpen(false)}>
            <UserRound />
            {t("nav.profile")}
          </NavItem>
        </div>
        <div className="sidebar-bottom">
          <div className="support-box">
            <Headset size={22} className="text-primary" />
            <h3 className="mt-2 text-xs font-bold">{t("nav.supportTitle")}</h3>
            <p>{t("nav.supportText")}</p>
            <Button asChild variant="outline" size="sm" className="w-full text-primary">
              <a href="mailto:support@krushimitra.example">
                {t("nav.contactSupport")} <ChevronRight size={13} />
              </a>
            </Button>
          </div>
          <Link
            to={admin ? "/login" : "/admin/login"}
            className="nav-item"
            onClick={() => setOpen(false)}
          >
            <ShieldCheck />
            {t(admin ? "nav.farmerSignIn" : "nav.adminPortal")}
            <ChevronRight className="ml-auto" />
          </Link>
          <button type="button" className="nav-item w-full cursor-pointer text-left" onClick={signOut}>
            <LogOut />
            {t("nav.logout")}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu shrink-0"
              aria-label={t(open ? "nav.closeMenu" : "nav.openMenu")}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
            <div className="min-w-0">
              <div className="topbar-title truncate">{current}</div>
              <div className="breadcrumb">
                <span>{t(admin ? "nav.admin" : "nav.farmer")}</span>
                <ChevronRight size={10} />
                <span>{current}</span>
              </div>
            </div>
          </div>
          <div className="topbar-right">
            <LanguageSelector className="language-text" />
            <Button asChild variant="ghost" size="icon" className="relative" title={t("nav.notifications")}>
              <Link to="/notifications" aria-label={unread ? t("nav.notificationsUnread", { count: unread }) : t("nav.notifications")}>
                <Bell size={19} />
                {unread > 0 && (
                  <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </Link>
            </Button>
            <div className="topbar-divider" />
            <Link to="/profile" className="flex items-center gap-2.5">
              <span className="avatar">{initials(user.name)}</span>
              <div className="topbar-profile-text">
                <div className="text-xs font-semibold">{user.name}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin size={10} />
                  {user.location}
                </div>
              </div>
              <ChevronDown size={12} className="topbar-profile-text" />
            </Link>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
          <footer className="footer">
            <span>{t("nav.copyright", { year: new Date().getFullYear() })}</span>
            <span className="flex items-center gap-1.5">
              <Leaf size={11} className="text-primary" />
              {t("nav.madeFor")}
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}
