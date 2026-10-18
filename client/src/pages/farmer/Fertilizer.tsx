import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/common/shared";
import { useAuth } from "@/context/AuthContext";
import { useFertilizerPlan } from "@/api/hooks";
import { CROP_KEYS, cropLabel } from "@/lib/cropLabel";
import { downloadCSV } from "@/lib/csv";
import { errorMessage } from "@/lib/errors";
import { formatRange } from "@/lib/explain";
import { usePageTitle } from "@/lib/usePageTitle";

export function FertilizerPage() {
  const { t } = useTranslation();
  usePageTitle(t("fertilizer.pageTitle"));
  const { user } = useAuth();
  const [params] = useSearchParams();
  const mutation = useFertilizerPlan();
  const initial = params.get("crop");
  const [crop, setCrop] = useState(
    (CROP_KEYS as readonly string[]).includes(initial ?? "") ? (initial as string) : "rice",
  );
  const [area, setArea] = useState(String(user?.land && user.land > 0 ? user.land : 1));
  const plan = mutation.data;

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ crop, area: Number(area) });
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  const sorted = [...CROP_KEYS].sort((a, b) => cropLabel(t, a).localeCompare(cropLabel(t, b)));

  return (
    <>
      <PageHeading title={t("fertilizer.title")} description={t("fertilizer.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("fertilizer.details")}>
          <form className="space-y-5 p-6" onSubmit={(e) => void submit(e)}>
            <label>
              {t("fertilizer.crop")}
              <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                {sorted.map((c) => (
                  <option key={c} value={c}>
                    {cropLabel(t, c)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("fertilizer.area")}
              <input
                required
                type="number"
                min="0.1"
                max="10000"
                step="0.1"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </label>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              <FlaskConical />
              {mutation.isPending ? t("fertilizer.generating") : t("fertilizer.generate")}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("fertilizer.disclaimer")}</p>
          </form>
        </Panel>
        <Panel
          title={plan ? t("fertilizer.planTitle", { crop: cropLabel(t, plan.crop), area: plan.areaAcres }) : t("fertilizer.yourPlan")}
          subtitle={plan ? t("fertilizer.planSub") : t("fertilizer.yourPlanSub")}
        >
          <div className="p-6" aria-live="polite">
            {plan ? (
              <>
                {plan.nutrients ? (
                  <>
                    <div className="space-y-4">
                      {plan.nutrients.map((n) => (
                        <div key={n.key} className="flex items-center justify-between gap-4 border-b pb-4">
                          <div>
                            <div>{t(`nutrients.${n.key}`)}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {t("fertilizer.recommended")}: {formatRange(n.perHa.min, n.perHa.max)} {t("units.kg_ha")}
                            </div>
                          </div>
                          <strong className="text-primary">
                            {formatRange(n.total.min, n.total.max)} {t("units.kg")}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <h3 className="mb-3 mt-6 font-semibold">{t("fertilizer.stages")}</h3>
                    <p className="text-sm leading-7 text-muted-foreground">{t(`fert.timing.${plan.timing}`)}</p>
                    {plan.extra && (
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`fert.extra.${plan.extra}`)}</p>
                    )}
                    <Button
                      variant="outline"
                      className="mt-5"
                      onClick={() =>
                        downloadCSV(
                          "nutrient-plan.csv",
                          (plan.nutrients ?? []).map((n) => ({
                            crop: plan.crop,
                            acres: plan.areaAcres,
                            nutrient: n.key,
                            kg_per_hectare_min: n.perHa.min,
                            kg_per_hectare_max: n.perHa.max,
                            total_kg_min: n.total.min,
                            total_kg_max: n.total.max,
                          })),
                        )
                      }
                    >
                      <Download />
                      {t("fertilizer.download")}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm leading-7 text-muted-foreground">{t("fert.timing.follow_local")}</p>
                )}
                <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  {t("fertilizer.source")}: {plan.source}. {t("fertilizer.soilTest")}{" "}
                  <Link to="/crops" className="font-semibold text-primary">
                    {t("fertilizer.seeCrops")}
                  </Link>
                </p>
              </>
            ) : (
              <div className="empty-state">
                <FlaskConical size={45} className="mx-auto mb-5 text-primary" />
                {t("fertilizer.empty")}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
