import { useState, type FormEvent } from "react";
import { Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, PageHeading, Panel } from "@/components/common/shared";
import { ErrorState, Loading } from "@/components/common/states";
import { useAdminFarmers, useFarmerMutations } from "@/api/hooks";
import type { AdminFarmer, Soil } from "@/api/types";
import { downloadCSV } from "@/lib/csv";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatShortDate } from "@/lib/intl";
import { useDebounced } from "@/lib/useDebounced";
import { usePageTitle } from "@/lib/usePageTitle";

interface Draft {
  id?: number;
  name: string;
  email: string;
  location: string;
  land: string;
  soil: Soil;
  password: string;
}

const blank: Draft = { name: "", email: "", location: "", land: "1", soil: "Loamy", password: "" };

export function FarmersPage() {
  const { t } = useTranslation();
  usePageTitle(t("admin.farmersTitle"));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [draft, setDraft] = useState<Draft | null>(null);
  const q = useDebounced(query.trim());
  const farmers = useAdminFarmers(q, status);
  const { save, setStatus: changeStatus } = useFarmerMutations();
  const rows = farmers.data?.farmers ?? [];

  function edit(f: AdminFarmer) {
    setDraft({ id: f.id, name: f.name, email: f.email, location: f.location, land: String(f.land), soil: f.soil, password: "" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const { password, land, ...rest } = draft;
    try {
      await save.mutateAsync({ ...rest, land: Number(land), ...(password ? { password } : {}) });
      toast.success(t(draft.id ? "admin.farmerUpdated" : "admin.farmerAdded"));
      setDraft(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  async function toggle(f: AdminFarmer) {
    try {
      await changeStatus.mutateAsync({ id: f.id, status: f.status === "Active" ? "Inactive" : "Active" });
      toast.success(t(f.status === "Active" ? "admin.nowInactive" : "admin.nowActive", { name: f.name }));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  return (
    <>
      <PageHeading
        title={t("admin.farmersTitle")}
        description={t("admin.farmersSub")}
        action={
          <Button onClick={() => setDraft(blank)}>
            <Plus />
            {t("admin.addFarmer")}
          </Button>
        }
      />
      <div className="filters">
        <input
          aria-label={t("admin.searchFarmers")}
          placeholder={t("admin.searchFarmers")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label={t("admin.colStatus")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="All statuses">{t("admin.allStatuses")}</option>
          <option value="Active">{t("status.Active")}</option>
          <option value="Inactive">{t("status.Inactive")}</option>
        </select>
        <Button
          variant="outline"
          className="ml-auto"
          disabled={!rows.length}
          onClick={() =>
            downloadCSV(
              "farmers.csv",
              rows.map(({ id, name, email, location, land, soil, status, joined }) => ({
                id, name, email, location, land_acres: land, soil, status, joined,
              })),
            )
          }
        >
          <Download />
          {t("common.export")}
        </Button>
      </div>
      <Panel>
        {farmers.isPending ? (
          <Loading />
        ) : farmers.isError ? (
          <ErrorState error={farmers.error} onRetry={() => farmers.refetch()} />
        ) : (
          <>
            <div className="table-scroll">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>{t("admin.colFarmer")}</th>
                    <th>{t("admin.colLocation")}</th>
                    <th>{t("admin.colAreaShort")}</th>
                    <th>{t("admin.colJoined")}</th>
                    <th>{t("admin.colStatus")}</th>
                    <th>{t("admin.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.name}</strong>
                        <div className="mt-1 text-muted-foreground">{f.email}</div>
                      </td>
                      <td>{f.location}</td>
                      <td>{formatNumber(f.land)} {t("units.acres")}</td>
                      <td>{formatShortDate(f.joined)}</td>
                      <td>
                        <span className={`tag ${f.status === "Inactive" ? "sun" : ""}`}>{t(`status.${f.status}`)}</span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => edit(f)}>
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={changeStatus.isPending}
                            onClick={() => void toggle(f)}
                          >
                            {t(f.status === "Active" ? "admin.deactivate" : "admin.activate")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <div className="empty-state">{t("admin.noFarmers")}</div>}
          </>
        )}
      </Panel>
      {draft && (
        <Dialog title={t(draft.id ? "admin.editFarmer" : "admin.addFarmer")} onClose={() => setDraft(null)}>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <label>
              {t("profile.fullName")}
              <input
                required
                minLength={2}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              {t("auth.email")}
              <input
                required
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label>
              {t("profile.location")}
              <input
                required
                minLength={2}
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                {t("profile.area")}
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={draft.land}
                  onChange={(e) => setDraft({ ...draft, land: e.target.value })}
                />
              </label>
              <label>
                {t("profile.soil")}
                <select
                  value={draft.soil}
                  onChange={(e) => setDraft({ ...draft, soil: e.target.value as Soil })}
                >
                  <option value="Clay">{t("soil.Clay")}</option>
                  <option value="Loamy">{t("soil.Loamy")}</option>
                  <option value="Sandy">{t("soil.Sandy")}</option>
                </select>
              </label>
            </div>
            <label>
              {t(draft.id ? "admin.resetPassword" : "admin.tempPassword")}{" "}
              <span className="text-muted-foreground">({t("common.optional")})</span>
              <input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder={t(draft.id ? "admin.keepPassword" : "admin.letSignIn")}
              />
            </label>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("admin.saveFarmer")}
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
