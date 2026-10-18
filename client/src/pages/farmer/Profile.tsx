import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/common/shared";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { useAuth } from "@/context/AuthContext";
import { useCrops } from "@/api/hooks";
import { api, tokenStore } from "@/api/client";
import type { Moisture, Prefs, Soil, User, WaterAvailability } from "@/api/types";
import { cropLabel } from "@/lib/cropLabel";
import { errorMessage } from "@/lib/errors";
import { usePageTitle } from "@/lib/usePageTitle";

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];

function ChangePassword() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ token: string }>("/auth/change-password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      tokenStore.set(res.token); // other sessions were signed out; keep this one
      toast.success(t("profile.passwordChanged"));
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t("profile.changePassword")}>
      <form className="space-y-4 p-6" onSubmit={(e) => void submit(e)}>
        <label>
          {t("profile.currentPassword")}
          <input required type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label>
          {t("profile.newPassword")}
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t("auth.passwordHint")}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? t("profile.updating") : t("profile.updatePassword")}
        </Button>
      </form>
    </Panel>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  usePageTitle(t("profile.pageTitle"));
  const { user, setUser } = useAuth();
  const crops = useCrops(user?.role !== "admin");
  const [draft, setDraft] = useState(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    location: user?.location ?? "",
    land: String(user?.land ?? ""),
    soil: (user?.soil ?? "Loamy") as Soil,
    state: user?.state ?? "",
    soilPh: user?.soilPh != null ? String(user.soilPh) : "",
    soilMoisture: (user?.soilMoisture ?? "") as Moisture | "",
    waterAvailability: (user?.waterAvailability ?? "") as WaterAvailability | "",
  }));
  const [prefs, setPrefs] = useState<Prefs>(user?.prefs ?? { emailAlerts: true, weatherAlerts: true });
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const admin = user.role === "admin";
  const saved = (crops.data?.crops ?? []).filter((c) => c.saved);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { user: updated } = await api<{ user: User }>("/profile", {
        method: "PUT",
        body: {
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          location: draft.location,
          land: admin ? 0 : Number(draft.land),
          soil: draft.soil,
          prefs,
          ...(admin
            ? {}
            : {
                // blank optional fields clear the stored value
                state: draft.state || null,
                soilPh: draft.soilPh.trim() === "" ? null : Number(draft.soilPh),
                soilMoisture: draft.soilMoisture || null,
                waterAvailability: draft.waterAvailability || null,
              }),
        },
      });
      setUser(updated);
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        title={t(admin ? "profile.titleAdmin" : "profile.title")}
        description={t(admin ? "profile.subtitleAdmin" : "profile.subtitle")}
      />
      <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]" onSubmit={(e) => void submit(e)}>
        <div className="space-y-6">
          <Panel title={t(admin ? "profile.accountDetails" : "profile.personalDetails")}>
            <div className="p-6">
              <div className="form-grid">
                <label>
                  {t("profile.fullName")}
                  <input required minLength={2} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <label>
                  {t("auth.email")}
                  <input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </label>
                <label>
                  {t("profile.phone")}
                  <input
                    pattern="[0-9]{10}"
                    title={t("profile.phoneHint")}
                    inputMode="numeric"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </label>
                <label>
                  {t("profile.location")}
                  <input required minLength={2} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                </label>
              </div>
            </div>
          </Panel>
          {!admin && (
            <Panel title={t("profile.farmDetails")} subtitle={t("profile.farmDetailsSub")}>
              <div className="p-6">
                <div className="form-grid">
                  <label>
                    {t("profile.area")}
                    <input required type="number" min="0.1" step="0.1" value={draft.land} onChange={(e) => setDraft({ ...draft, land: e.target.value })} />
                  </label>
                  <label>
                    {t("profile.soil")}
                    <select value={draft.soil} onChange={(e) => setDraft({ ...draft, soil: e.target.value as Soil })}>
                      {(["Clay", "Loamy", "Sandy"] as const).map((s) => (
                        <option key={s} value={s}>
                          {t(`soil.${s}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("profile.state")}
                    <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })}>
                      <option value="">{t("profile.notSet")}</option>
                      {STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("profile.soilPh")} <span className="text-muted-foreground">({t("common.optional")})</span>
                    <input
                      type="number"
                      min="3.5"
                      max="9.5"
                      step="0.1"
                      inputMode="decimal"
                      value={draft.soilPh}
                      onChange={(e) => setDraft({ ...draft, soilPh: e.target.value })}
                      placeholder={t("profile.soilPhHint")}
                    />
                  </label>
                  <label>
                    {t("profile.moisture")} <span className="text-muted-foreground">({t("common.optional")})</span>
                    <select value={draft.soilMoisture} onChange={(e) => setDraft({ ...draft, soilMoisture: e.target.value as Moisture | "" })}>
                      <option value="">{t("profile.notSet")}</option>
                      {(["Dry", "Moderate", "Moist"] as const).map((m) => (
                        <option key={m} value={m}>
                          {t(`moisture.${m}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("profile.water")} <span className="text-muted-foreground">({t("common.optional")})</span>
                    <select
                      value={draft.waterAvailability}
                      onChange={(e) => setDraft({ ...draft, waterAvailability: e.target.value as WaterAvailability | "" })}
                    >
                      <option value="">{t("profile.notSet")}</option>
                      {(["Rainfed", "Limited", "Assured"] as const).map((w) => (
                        <option key={w} value={w}>
                          {t(`water.${w}`)} — {t(`waterHint.${w}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("profile.accuracyNote")}</p>
              </div>
            </Panel>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? t("common.saving") : t("profile.save")}
          </Button>
        </div>
        <div className="space-y-6">
          <Panel title={t("language.label")}>
            <div className="p-6">
              <LanguageSelector />
              <p className="mt-3 text-xs text-muted-foreground">{t("language.hint")}</p>
            </div>
          </Panel>
          <Panel title={t("profile.notifPrefs")}>
            <div className="space-y-5 p-6">
              <label className="flex items-center justify-between gap-4">
                {t("profile.emailUpdates")}
                <input type="checkbox" checked={prefs.emailAlerts} onChange={(e) => setPrefs({ ...prefs, emailAlerts: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between gap-4">
                {t("profile.weatherAlerts")}
                <input type="checkbox" checked={prefs.weatherAlerts} onChange={(e) => setPrefs({ ...prefs, weatherAlerts: e.target.checked })} />
              </label>
              <p className="text-xs text-muted-foreground">{t("profile.prefsNote")}</p>
            </div>
          </Panel>
          {!admin && (
            <Panel title={t("profile.savedPlans")}>
              <div className="p-6">
                {saved.length ? (
                  saved.map((c) => (
                    <span key={c.key} className="tag mb-2 mr-2">
                      <Sprout size={12} />
                      {cropLabel(t, c.key)}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">{t("profile.noSaved")}</p>
                )}
                <Button asChild variant="link" className="mt-3 px-0">
                  <Link to="/crops">
                    {t("profile.exploreCrops")} <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Panel>
          )}
        </div>
      </form>
      <div className="mt-6 max-w-xl">
        <ChangePassword />
      </div>
    </>
  );
}
