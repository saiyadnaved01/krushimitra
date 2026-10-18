import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sprout, Wheat, LandPlot, IndianRupee, ArrowRight, Droplets, Wind, CloudRain, MapPin,
  ScanLine, CalendarDays, TrendingUp, CloudSun, Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel, Stat, Trend, CropPhoto } from "@/components/common/shared";
import { YieldChart } from "@/components/common/YieldChart";
import { ErrorState, Loading } from "@/components/common/states";
import { useAuth } from "@/context/AuthContext";
import { useCrops, useDashboard, usePrices, useTasks } from "@/api/hooks";
import type { Dashboard as DashboardData } from "@/api/types";
import { DAY_PART_EMOJI, dayPart } from "@/lib/format";
import { cropLabel, taskCropLabel } from "@/lib/cropLabel";
import { formatClock, formatDate, formatNumber, formatPercent, formatRupees } from "@/lib/intl";
import { usePageTitle } from "@/lib/usePageTitle";
import banner from "@/assets/farm-banner.jpg";

function WeatherSummary({ weather }: { weather: DashboardData["weather"] }) {
  const { t } = useTranslation();
  const { current } = weather;
  return (
    <Panel
      title={t("dashboard.todayWeather")}
      action={
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin size={11} />
          {weather.location}
        </span>
      }
      className="weather-panel"
    >
      <div className="weather-current">
        <div>
          <div className="weather-temperature">
            {formatNumber(current.temp)}
            <span className="text-2xl">°C</span>
          </div>
          <p>{t(`weather.summary.${current.summary}`)}</p>
          <span className="text-[10px] text-muted-foreground">
            {t("weather.feelsLike", { temp: formatNumber(current.feelsLike) })}
          </span>
        </div>
        <CloudSun size={69} className="text-sun" strokeWidth={1.5} />
      </div>
      <div className="weather-metrics">
        <div>
          <span>
            <Droplets size={12} />
            {t("weather.humidity")}
          </span>
          <strong>{formatPercent(current.humidity)}</strong>
        </div>
        <div>
          <span>
            <Wind size={12} />
            {t("weather.wind")}
          </span>
          <strong>{t("weather.windValue", { speed: formatNumber(current.wind) })}</strong>
        </div>
        <div>
          <span>
            <CloudRain size={12} />
            {t("weather.rainChance")}
          </span>
          <strong>{formatPercent(current.rainChance)}</strong>
        </div>
      </div>
      <div className="weather-note">
        <Leaf size={15} className="shrink-0" />
        <span>{t(`weather.advice.${weather.advice}`)}</span>
      </div>
    </Panel>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  usePageTitle(t("dashboard.pageTitle"));
  const { user } = useAuth();
  const [months, setMonths] = useState(6);
  const dashboard = useDashboard(months);
  const crops = useCrops();
  const prices = usePrices("", "All markets");
  const tasks = useTasks();

  const part = dayPart();
  const upcoming = (tasks.data?.tasks ?? []).filter((x) => !x.done).slice(0, 3);

  if (dashboard.isPending && !dashboard.data) return <Loading label={t("dashboard.loading")} />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;
  const data = dashboard.data;
  if (!data || !user) return null;
  const { stats } = data;

  return (
    <>
      <PageHeading
        title={`${t(`dashboard.greeting.${part}`, { name: user.name.split(" ")[0] })} ${DAY_PART_EMOJI[part]}`}
        description={t("dashboard.subtitle")}
      />
      <div className="farm-hero">
        <img src={banner} width={1536} height={512} alt={t("dashboard.heroAlt")} />
        <div className="farm-hero-content">
          <div className="hero-eyebrow">
            <Sprout size={13} />
            {t("dashboard.heroEyebrow")}
          </div>
          <h2>{t("dashboard.heroTitle")}</h2>
          <p>{t("dashboard.heroText")}</p>
          <Button asChild variant="hero" size="sm">
            <Link to="/crops">
              {t("dashboard.heroCta")} <ArrowRight size={13} />
            </Link>
          </Button>
        </div>
      </div>
      <div className="stat-grid">
        <Stat
          title={t("dashboard.statArea")}
          value={formatNumber(stats.area)}
          unit={t("units.acres")}
          icon={LandPlot}
          foot={stats.activeFields ? t("dashboard.acrossFields", { count: stats.activeFields }) : t("dashboard.addTasksHint")}
        />
        <Stat
          title={t("dashboard.statCrops")}
          value={formatNumber(stats.activeFields)}
          icon={Sprout}
          foot={t("dashboard.thisSeason")}
          tone="sun"
        />
        <Stat
          title={t("dashboard.statYield")}
          value={formatNumber(stats.estimatedYield)}
          unit={t("units.quintals")}
          icon={Wheat}
          change={stats.yieldChange}
          foot={stats.yieldChange == null ? t("dashboard.noYieldRecords") : t("dashboard.vsLastSeason")}
        />
        <Stat
          title={t("dashboard.statRevenue")}
          value={formatRupees(stats.estimatedRevenue)}
          icon={IndianRupee}
          change={stats.revenueChange}
          foot={stats.revenueChange == null ? t("dashboard.noRevenueRecords") : t("dashboard.vsLastSeason")}
          tone="water"
        />
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-left">
          <Panel
            title={t("dashboard.performance")}
            subtitle={t("dashboard.performanceSub", { count: months })}
            action={
              <select
                aria-label={t("dashboard.period")}
                className="min-h-0! w-auto! py-1.5! text-[10px]!"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                <option value={6}>{t("dashboard.last6")}</option>
                <option value={3}>{t("dashboard.last3")}</option>
              </select>
            }
          >
            <div className="chart-legend">
              <span>
                <i className="legend-dot" />
                {t("dashboard.actualYield")}
              </span>
              <span>
                <i className="legend-dot water" />
                {t("dashboard.expectedYield")}
              </span>
              <span className="ml-auto">{t("dashboard.yieldAxis")}</span>
            </div>
            <YieldChart data={data.yields} />
          </Panel>
          <Panel title={t("dashboard.quickActions")} subtitle={t("dashboard.quickSub")}>
            <div className="quick-grid">
              {[
                { to: "/disease", label: t("dashboard.qaDisease"), icon: ScanLine, tone: "" },
                { to: "/crops", label: t("dashboard.qaCrops"), icon: Sprout, tone: "sun" },
                { to: "/schedule", label: t("dashboard.qaPlan"), icon: CalendarDays, tone: "water" },
                { to: "/market", label: t("dashboard.qaPrices"), icon: TrendingUp, tone: "" },
              ].map((a) => (
                <Link to={a.to} key={a.to} className="quick-item">
                  <span className={`stat-icon ${a.tone}`}>
                    <a.icon size={21} />
                  </span>
                  {a.label}
                </Link>
              ))}
            </div>
          </Panel>
          <Panel
            title={t("dashboard.recommended")}
            subtitle={t("dashboard.recommendedSub", { soil: t(`soil.${user.soil}`) })}
            action={
              <Button asChild variant="link" size="sm">
                <Link to="/crops">
                  {t("common.viewAll")} <ArrowRight size={12} />
                </Link>
              </Button>
            }
          >
            {crops.isPending ? (
              <Loading />
            ) : (
              <div className="crops-grid">
                {(crops.data?.crops ?? []).slice(0, 3).map((c) => (
                  <Link to="/crops" key={c.key} className="crop-preview">
                    <CropPhoto imageKey={c.imageKey} alt={t("crops.photoAlt", { crop: cropLabel(t, c.key) })} />
                    <h3>{cropLabel(t, c.key)}</h3>
                    <p>{t(`seasons.${c.season}`)}</p>
                    <span className="crop-label">
                      {t("crops.matchPercent", { value: formatNumber(c.match) })} <Sprout size={9} className="ml-1 inline" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="dashboard-right">
          <WeatherSummary weather={data.weather} />
          <Panel
            title={t("dashboard.marketGlance")}
            subtitle={t("dashboard.marketGlanceSub")}
            action={
              <span className="tag">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {t("dashboard.updated")}
              </span>
            }
          >
            {prices.isPending ? (
              <Loading />
            ) : (
              <table className="market-table">
                <thead>
                  <tr>
                    <th>{t("market.colCrop")}</th>
                    <th>{t("market.colPrice")}</th>
                    <th>{t("market.colChange")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(prices.data?.prices ?? []).slice(0, 4).map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{cropLabel(t, p.crop)}</td>
                      <td>{formatRupees(p.price)}</td>
                      <td>
                        <Trend value={p.change} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Button asChild variant="link" className="h-11 w-full text-[11px]">
              <Link to="/market">
                {t("dashboard.viewAllPrices")} <ArrowRight size={12} />
              </Link>
            </Button>
          </Panel>
          <Panel
            title={t("dashboard.upcoming")}
            subtitle={t("dashboard.upcomingSub")}
            action={<CalendarDays size={17} className="text-muted-foreground" />}
          >
            {tasks.isPending ? (
              <Loading />
            ) : upcoming.length ? (
              upcoming.map((task) => (
                <Link to="/schedule" className="task-row" key={task.id}>
                  <span className="task-date">
                    {formatDate(task.date, { day: "2-digit" })}
                    <small>{formatDate(task.date, { month: "short" })}</small>
                  </span>
                  <div className="min-w-0">
                    <h4>{task.title}</h4>
                    <p>
                      {taskCropLabel(t, task.crop)} · {formatClock(task.time)}
                    </p>
                  </div>
                  <span
                    className={`tag ${task.category === "Irrigation" ? "water" : task.category === "Fertilizer" ? "sun" : ""}`}
                  >
                    {t(`categories.${task.category}`)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="empty-state">{t("dashboard.noTasks")}</div>
            )}
            <Button asChild variant="link" className="h-11 w-full text-[11px]">
              <Link to="/schedule">
                {t("dashboard.viewSchedule")} <ArrowRight size={12} />
              </Link>
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}
