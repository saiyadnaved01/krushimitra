import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { YieldPoint } from "@/api/types";

export function YieldChart({ data }: { data: YieldPoint[] }) {
  const { t } = useTranslation();
  const gradientId = useId();
  if (!data.length) {
    return <div className="empty-state">{t("dashboard.noYield")}</div>;
  }
  const max = Math.max(...data.flatMap((d) => [d.actual, d.expected]));
  const top = Math.max(10, Math.ceil(max / 10) * 10);
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            domain={[0, top]}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="expected"
            name={t("dashboard.expectedYield")}
            stroke="var(--water)"
            strokeDasharray="5 5"
            strokeWidth={2}
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="actual"
            name={t("dashboard.actualYield")}
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

