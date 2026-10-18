import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CropPhoto, Dialog, PageHeading, Panel } from "@/components/common/shared";
import { QueryState } from "@/components/common/states";
import { useCrops, useToggleSavedCrop } from "@/api/hooks";
import type { Crop, CropsResponse } from "@/api/types";
import { cropLabel } from "@/lib/cropLabel";
import { errorMessage } from "@/lib/errors";
import { explainFactor, formatRange } from "@/lib/explain";
import { formatMonths, formatNumber } from "@/lib/intl";
import { usePageTitle } from "@/lib/usePageTitle";

const FACTOR_ORDER = ["soil", "temperature", "water", "ph", "season", "region", "moisture"] as const;

function ProfileSummary({ data }: { data: CropsResponse }) {
  const { t } = useTranslation();
  const { profile, climate, missing } = data;
  const items: [string, string | null][] = [
    [t("crops.inputSoil"), t(`soil.${profile.soil}`)],
    [t("crops.inputPh"), profile.ph != null ? formatNumber(profile.ph) : null],
    [t("crops.inputMoisture"), profile.moisture ? t(`moisture.${profile.moisture}`) : null],
    [t("crops.inputWater"), profile.waterAvailability ? t(`water.${profile.waterAvailability}`) : null],
    [t("crops.inputState"), profile.state],
    [t("crops.inputClimate"), climate.available ? (climate.place ?? t("common.yes")) : null],
  ];
  return (
    <Panel title={t("crops.basedOn")} subtitle={t("crops.basedOnSub")} className="mb-6">
      <div className="p-6 pt-3">
        <dl className="detail-list">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value ? "" : "text-muted-foreground"}>{value ?? t("crops.notProvided")}</dd>
            </div>
          ))}
        </dl>
        {missing.length > 0 && (
          <div className="callout mt-4">
            {t("crops.improveHint")}{" "}
            <Link to="/profile">{t("crops.updateProfile")}</Link>
            {missing.includes("climate") && <> · {t("crops.climateMissing")}</>}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Guidance({ crop }: { crop: Crop }) {
  const { t } = useTranslation();
  const g = crop.guidance;
  const { sowing, harvest, fertilizer } = g;
  return (
    <div className="guidance">
      <h3>{t("guidance.sowing")}</h3>
      <ul>
        <li>
          <strong>{t("guidance.window")}:</strong> {formatMonths(sowing.months)}
        </li>
        <li>
          <strong>{t("guidance.method")}:</strong> {t(`guidance.methods.${sowing.method}`)}
        </li>
        {sowing.seedRate && (
          <li>
            <strong>{t("guidance.seedRate")}:</strong>{" "}
            {formatRange(sowing.seedRate.min, sowing.seedRate.max)} {t(`units.${sowing.seedRate.unit}`)}
          </li>
        )}
        {sowing.spacing && (
          <li>
            <strong>{t("guidance.spacing")}:</strong>{" "}
            {sowing.spacing.plant
              ? t("guidance.spacingRowPlant", {
                  row: formatRange(sowing.spacing.row[0] ?? 0, sowing.spacing.row[1] ?? sowing.spacing.row[0] ?? 0),
                  plant: formatRange(sowing.spacing.plant[0] ?? 0, sowing.spacing.plant[1] ?? sowing.spacing.plant[0] ?? 0),
                })
              : t("guidance.spacingRow", {
                  row: formatRange(sowing.spacing.row[0] ?? 0, sowing.spacing.row[1] ?? sowing.spacing.row[0] ?? 0),
                })}
          </li>
        )}
      </ul>

      <h3>{t("guidance.irrigation")}</h3>
      <ul>
        <li>{t(`irrigation.${g.irrigation}`)}</li>
        <li>
          <strong>{t("guidance.waterNeed")}:</strong> {t(`waterNeed.${crop.water}`)} (
          {t("guidance.waterMm", { min: formatNumber(g.waterMm[0]), max: formatNumber(g.waterMm[1]) })})
        </li>
      </ul>

      <h3>{t("guidance.fertilizer")}</h3>
      {fertilizer ? (
        <>
          <table className="nutrient-table">
            <thead>
              <tr>
                <th>{t("guidance.nutrient")}</th>
                <th>{t("guidance.perHectare")}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["N", fertilizer.n],
                  ["P2O5", fertilizer.p],
                  ["K2O", fertilizer.k],
                ] as const
              ).map(([key, r]) => (
                <tr key={key}>
                  <td>{t(`nutrients.${key}`)}</td>
                  <td>
                    {formatRange(r.min, r.max)} {t("units.kg_ha")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-2">
            <li>{t(`fert.timing.${fertilizer.timing}`)}</li>
            {fertilizer.extra && <li>{t(`fert.extra.${fertilizer.extra}`)}</li>}
            <li>
              <Link to={`/fertilizer?crop=${crop.key}`} className="font-semibold text-primary">
                {t("guidance.calculateForFarm")}
              </Link>
            </li>
          </ul>
        </>
      ) : (
        <ul>
          <li>{t("fert.timing.follow_local")}</li>
        </ul>
      )}

      <h3>{t("guidance.harvest")}</h3>
      <ul>
        {harvest.months.length > 0 && (
          <li>
            <strong>{t("guidance.harvestWindow")}:</strong> {formatMonths(harvest.months)}
          </li>
        )}
        <li>
          <strong>{t("guidance.duration")}:</strong>{" "}
          {t("guidance.days", { range: formatRange(harvest.durationDays[0], harvest.durationDays[1]) })}
        </li>
        <li>{t(`harvest.${harvest.indicator}`)}</li>
      </ul>
    </div>
  );
}

export function CropsPage() {
  const { t } = useTranslation();
  usePageTitle(t("crops.pageTitle"));
  const crops = useCrops();
  const toggle = useToggleSavedCrop();
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  async function setSaved(crop: Crop, save: boolean) {
    try {
      await toggle.mutateAsync({ crop: crop.name, save });
      toast.success(t(save ? "crops.saved" : "crops.removed", { crop: cropLabel(t, crop.key) }));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  return (
    <>
      <PageHeading title={t("crops.title")} description={t("crops.subtitle")} />
      <QueryState query={crops}>
        {(data) => {
          const ranked = data.crops.map((c, i) => ({ c, rank: i + 1 }));
          const filtered = ranked.filter(
            ({ c }) =>
              cropLabel(t, c.key).toLowerCase().includes(query.trim().toLowerCase()) &&
              (season === "all" || c.season === season),
          );
          const current = selected ? data.crops.find((c) => c.key === selected) : undefined;
          return (
            <>
              <ProfileSummary data={data} />
              <div className="filters">
                <input
                  aria-label={t("crops.search")}
                  placeholder={t("crops.search")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select aria-label={t("crops.season")} value={season} onChange={(e) => setSeason(e.target.value)}>
                  <option value="all">{t("crops.allSeasons")}</option>
                  <option value="Kharif">{t("seasons.Kharif")}</option>
                  <option value="Rabi">{t("seasons.Rabi")}</option>
                  <option value="Annual">{t("seasons.Annual")}</option>
                  <option value="All seasons">{t("seasons.All seasons")}</option>
                </select>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("crops.count", { count: filtered.length })}
                </span>
              </div>
              <div className="content-grid">
                {filtered.map(({ c, rank }) => {
                  const known = c.factors.filter((f) => f.status !== "unknown");
                  const best = [...known].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                  const worst = [...known].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
                  return (
                    <article className="panel crop-card" key={c.key}>
                      <CropPhoto imageKey={c.imageKey} alt={t("crops.photoAlt", { crop: cropLabel(t, c.key) })} />
                      <div className="crop-body">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="flex items-center gap-2">
                            <span className="rank-badge">{formatNumber(rank)}</span>
                            {cropLabel(t, c.key)}
                          </h2>
                          <span className="tag">{t("crops.matchPercent", { value: formatNumber(c.match) })}</span>
                        </div>
                        <div className="my-3">
                          <div className="meter" aria-hidden>
                            <span style={{ width: `${c.match}%` }} />
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {t(`suitability.${c.suitability}`)} · {t("crops.confidence", { value: formatNumber(c.confidence) })}
                          </p>
                        </div>
                        <div className="mb-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
                          {best && <p>✓ {explainFactor(t, c, best)}</p>}
                          {worst && worst.key !== best?.key && worst.status !== "good" && (
                            <p>! {explainFactor(t, c, worst)}</p>
                          )}
                        </div>
                        <dl className="detail-list">
                          <div>
                            <dt>{t("crops.season")}</dt>
                            <dd>{t(`seasons.${c.season}`)}</dd>
                          </div>
                          <div>
                            <dt>{t("guidance.waterNeed")}</dt>
                            <dd>{t(`waterNeed.${c.water}`)}</dd>
                          </div>
                          <div>
                            <dt>{t("guidance.duration")}</dt>
                            <dd>
                              {t("guidance.days", {
                                range: formatRange(c.guidance.harvest.durationDays[0], c.guidance.harvest.durationDays[1]),
                              })}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("guidance.sowingWindow")}</dt>
                            <dd>{formatMonths(c.guidance.sowing.months)}</dd>
                          </div>
                        </dl>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => setSelected(c.key)}>
                            {t("crops.viewDetails")} <ArrowRight />
                          </Button>
                          <Button
                            variant={c.saved ? "secondary" : "outline"}
                            size="icon"
                            title={t(c.saved ? "crops.unsave" : "crops.save")}
                            aria-label={t(c.saved ? "crops.unsaveNamed" : "crops.saveNamed", { crop: cropLabel(t, c.key) })}
                            aria-pressed={c.saved}
                            disabled={toggle.isPending}
                            onClick={() => void setSaved(c, !c.saved)}
                          >
                            {c.saved ? <Check /> : <Plus />}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!filtered.length && (
                <Panel>
                  <div className="empty-state">{t("crops.none")}</div>
                </Panel>
              )}
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                {t("crops.disclaimer")} {t("crops.sources")}: {Object.values(data.sources).join("; ")}.
              </p>
              {current && (
                <Dialog
                  wide
                  title={`${cropLabel(t, current.key)} · ${t("crops.detailsTitle")}`}
                  onClose={() => setSelected(null)}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="tag">{t("crops.matchPercent", { value: formatNumber(current.match) })}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`suitability.${current.suitability}`)} · {t("crops.confidence", { value: formatNumber(current.confidence) })}
                    </span>
                  </div>
                  <div className="meter mb-4" aria-hidden>
                    <span style={{ width: `${current.match}%` }} />
                  </div>
                  <h3 className="mb-1 text-sm font-bold">{t("crops.why")}</h3>
                  <div>
                    {FACTOR_ORDER.map((key) => current.factors.find((f) => f.key === key)).map(
                      (f) =>
                        f && (
                          <div className="factor-row" key={f.key}>
                            <span className={`factor-dot ${f.status}`} aria-hidden />
                            <div>
                              <span className="factor-name">{t(`factors.${f.key}`)}</span>
                              <span className="sr-only">{t(`factorStatus.${f.status}`)}. </span>
                              {explainFactor(t, current, f)}
                            </div>
                          </div>
                        ),
                    )}
                  </div>
                  <Guidance crop={current} />
                  <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{t("crops.disclaimer")}</p>
                  <Button
                    className="mt-5 w-full"
                    variant={current.saved ? "outline" : "default"}
                    disabled={toggle.isPending}
                    onClick={() => void setSaved(current, !current.saved)}
                  >
                    {t(current.saved ? "crops.removeFromPlan" : "crops.saveToPlan")}
                  </Button>
                </Dialog>
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
}
