import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChartNoAxesCombined, IndianRupee, Sprout, UsersRound } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel, Stat } from "@/components/common/shared";
import { QueryState } from "@/components/common/states";
import { useAdminStats } from "@/api/hooks";
import { cropLabel } from "@/lib/cropLabel";
import { formatNumber, formatShortDate } from "@/lib/intl";
import { usePageTitle } from "@/lib/usePageTitle";

const COLORS = [
  "var(--primary)",
  "var(--sun)",
  "var(--water)",
  "oklch(0.62 0.1 20)",
  "oklch(0.6 0.07 300)",
  "oklch(0.7 0.02 150)",
];

export function AdminDashboard() {
  const { t } = useTranslation();
  usePageTitle(t("admin.analyticsTitle"));
  const stats = useAdminStats();
  return (
    <>
      <PageHeading
        title={t("admin.heading")}
        description={t("admin.subtitle")}
      />
      <QueryState query={stats}>
        {(s) => (
          <>
            <div className="stat-grid">
              <Stat
                title={t("admin.statFarmers")}
                value={formatNumber(s.registeredFarmers.value)}
                icon={UsersRound}
                change={s.registeredFarmers.change}
                foot={t("admin.vsLastMonth")}
              />
              <Stat
                title={t("admin.statRecs")}
                value={formatNumber(s.recommendations.value)}
                icon={Sprout}
                change={s.recommendations.change}
                foot={t("admin.vsLastMonth")}
                tone="sun"
              />
              <Stat
                title={t("admin.statArea")}
                value={formatNumber(s.activeArea.value)}
                unit={t("units.acres")}
                icon={ChartNoAxesCombined}
                change={s.activeArea.change}
                foot={t("admin.vsLastMonth")}
              />
              <Stat
                title={t("admin.statMarket")}
                value={formatNumber(s.marketRecords.value)}
                icon={IndianRupee}
                foot={t("admin.acrossMandis", { count: s.marketRecords.markets })}
                tone="water"
              />
            </div>
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <Panel title={t("admin.registrations")} subtitle={t("admin.registrationsSub")}>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={s.registrations} margin={{ left: -10, right: 20 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="farmers"
                        name={t("admin.newFarmers")}
                        fill="var(--primary)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={34}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title={t("admin.distribution")} subtitle={t("admin.distributionSub")}>
                {s.distribution.length ? (
                  <>
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={s.distribution}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={5}
                          >
                            {s.distribution.map((d, i) => (
                              <Cell key={d.name} fill={COLORS[i % COLORS.length] ?? "var(--primary)"} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="chart-legend mb-5 flex-wrap justify-center">
                      {s.distribution.map((d, i) => (
                        <span key={d.name}>
                          <i
                            className="legend-dot"
                            style={{ background: COLORS[i % COLORS.length] ?? "var(--primary)" }}
                          />
                          {cropLabel(t, d.name)} {formatNumber(d.value)}%
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">{t("admin.noRecords")}</div>
                )}
              </Panel>
            </div>
            <Panel
              title={t("admin.recentFarmers")}
              subtitle={t("admin.recentFarmersSub")}
              action={
                <Button asChild variant="link">
                  <Link to="/admin/farmers">
                    {t("common.viewAll")} <ArrowRight />
                  </Link>
                </Button>
              }
            >
              <div className="table-scroll">
                <table className="market-table">
                  <thead>
                    <tr>
                      <th>{t("admin.colFarmer")}</th>
                      <th>{t("admin.colLocation")}</th>
                      <th>{t("admin.colArea")}</th>
                      <th>{t("admin.colStatus")}</th>
                      <th>{t("admin.colJoined")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recentFarmers.map((f) => (
                      <tr key={f.id}>
                        <td className="font-semibold">{f.name}</td>
                        <td>{f.location}</td>
                        <td>{formatNumber(f.land)} {t("units.acres")}</td>
                        <td>
                          <span className={`tag ${f.status === "Inactive" ? "sun" : ""}`}>{t(`status.${f.status}`)}</span>
                        </td>
                        <td>{formatShortDate(f.joined)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </QueryState>
    </>
  );
}
