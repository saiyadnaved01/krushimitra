import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/Brand";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { homeFor } from "@/components/common/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/lib/usePageTitle";
import { errorMessage } from "@/lib/errors";
import { currentLanguage } from "@/i18n";
import type { Role } from "@/api/types";
import banner from "@/assets/farm-banner.jpg";

// The demo hint is only compiled into development builds. Production builds never show credentials.
const SHOW_DEMO_HINT = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_HINT !== "false";

/** Only go back to the page the visitor came from if their role may open it. */
function destination(role: Role, from: unknown) {
  if (typeof from === "string" && from.startsWith("/") && from.startsWith("/admin") === (role === "admin")) {
    return from;
  }
  return homeFor(role);
}

export function AuthPage({ register = false, admin = false }: { register?: boolean; admin?: boolean }) {
  const { t } = useTranslation();
  const portal: Role = admin ? "admin" : "farmer";
  usePageTitle(t(register ? "auth.titleRegister" : admin ? "auth.titleAdmin" : "auth.titleLogin"));

  const { user, login, register: signUp, demo } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in for this portal → go straight to the workspace.
  if (user && user.role === portal) {
    return <Navigate to={destination(user.role, from)} replace />;
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(success);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (register) {
      void run(
        () =>
          signUp({
            name,
            email,
            password,
            language: currentLanguage(),
            ...(farmLocation.trim() ? { location: farmLocation.trim() } : {}),
          }),
        t("auth.welcomeRegistered"),
      );
    } else {
      void run(() => login(email, password, portal), t(admin ? "auth.welcomeAdmin" : "auth.welcomeFarmer"));
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-image">
        <img src={banner} alt={t("auth.bannerAlt")} width={1536} height={512} />
        <div className="auth-image-copy">
          <Sprout size={44} />
          <h2 className="my-5 font-bold">{t("auth.heroTitle")}</h2>
          <p className="text-sm leading-7 opacity-80">{t("auth.heroText")}</p>
        </div>
      </div>
      <div className="auth-form">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Brand />
          <LanguageSelector />
        </div>
        {admin && (
          <span className="tag mb-3">
            <ShieldCheck size={12} />
            {t("auth.adminPortal")}
          </span>
        )}
        <h1>{t(register ? "auth.headingRegister" : admin ? "auth.headingAdmin" : "auth.headingLogin")}</h1>
        <p>{t(register ? "auth.subRegister" : "auth.subLogin")}</p>
        <form className="auth-fields" onSubmit={submit}>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {register && (
            <>
              <label>
                {t("auth.fullName")}
                <input
                  required
                  minLength={2}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth.fullNamePlaceholder")}
                />
              </label>
              <label>
                {t("auth.location")} <span className="text-muted-foreground">({t("common.optional")})</span>
                <input
                  autoComplete="address-level2"
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  placeholder={t("auth.locationPlaceholder")}
                />
              </label>
            </>
          )}
          <label>
            {t("auth.email")}
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
            />
          </label>
          <label>
            {t("auth.password")}
            <div className="relative">
              <input
                required
                type={show ? "text" : "password"}
                minLength={register ? 8 : 1}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={register ? t("auth.passwordHint") : ""}
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-2"
                aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </label>
          {register && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" required />
              {t("auth.agree")}
            </label>
          )}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? t("common.pleaseWait") : t(register ? "auth.createAccount" : "auth.signIn")}
            {!busy && <ArrowRight />}
          </Button>
        </form>
        {!register && SHOW_DEMO_HINT && (
          <div className="my-5 space-y-3 border-t pt-5">
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => void run(() => demo(portal), `Signed in to the ${portal} demo`)}
            >
              {admin ? "Explore Admin Demo" : "Explore Farmer Demo"}
            </Button>
            <div className="demo-credentials">
              Demo login:{" "}
              <code>{admin ? "admin@krushimitra.example" : "rajesh.patil@example.com"}</code> /{" "}
              <code>{admin ? "admin123" : "farmer123"}</code>
            </div>
          </div>
        )}
        <div className="mt-6 text-center text-sm">
          {!admin &&
            (register ? (
              <>
                {t("auth.haveAccount")}{" "}
                <Link to="/login" className="font-semibold text-primary">
                  {t("auth.signInLink")}
                </Link>
              </>
            ) : (
              <>
                {t("auth.newHere")}{" "}
                <Link to="/register" className="font-semibold text-primary">
                  {t("auth.createLink")}
                </Link>
              </>
            ))}
          {admin && (
            <Link to="/login" className="text-primary">
              {t("auth.backToFarmer")}
            </Link>
          )}
        </div>
        {!admin && !register && (
          <div className="mt-3 text-center text-xs">
            <Link to="/admin/login" className="text-muted-foreground hover:text-primary">
              {t("auth.adminLink")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
