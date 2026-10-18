import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { YieldChart } from "@/components/common/YieldChart";
import { PageHeading, Panel } from "@/components/common/shared";
import { QueryState } from "@/components/common/states";
import { fetchReport, useReport, useReportPeriods } from "@/api/hooks";
import type { ReportType } from "@/api/types";
import { downloadCSV } from "@/lib/csv";
import { usePageTitle } from "@/lib/usePageTitle";
import { errorMessage } from "@/lib/errors";
import { formatMonthYear } from "@/lib/intl";

const REPORTS: { type: ReportType; file: string }[] = [
  { type: "farmers", file: "farmer-report.csv" },
  { type: "market", file: "market-report.csv" },
  { type: "yield", file: "yield-report.csv" },
];

export function ReportsPage() {
  const { t } = useTranslation();
  usePageTitle(t("admin.reportsTitle"));
  const periods = useReportPeriods();
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState<ReportType | null>(null);
  const period = chosen || periods.data?.periods[0]?.value || "";
  const label = period ? formatMonthYear(`${period}-15`) : "";
  const yieldReport = useReport("yield", period);

  async function download(type: ReportType, file: string) {
    setBusy(type);
    try {
      const { rows } = await fetchReport(type, period);
      if (!downloadCSV(file, rows)) toast.info(t("admin.noPeriodData"));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeading
        title={t("admin.reportsTitle")}
        description={t("admin.reportsSub")}
        action={
          <select
            aria-label={t("admin.period")}
            value={period}
            onChange={(e) => setChosen(e.target.value)}
            className="w-44!"
          >
            {(periods.data?.periods ?? []).map((p) => (
              <option key={p.value} value={p.value}>
                {formatMonthYear(`${p.value}-15`)}
              </option>
            ))}
          </select>
        }
      />
      <div className="mb-6 content-grid">
        {REPORTS.map((r) => (
          <Panel key={r.type}>
            <div className="p-6">
              <span className="stat-icon">
                <FileText size={21} />
              </span>
              <h2 className="my-4 font-display text-lg font-bold">{t(`admin.report.${r.type}.title`)}</h2>
              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{t(`admin.report.${r.type}.text`)}</p>
              <p className="mb-4 text-xs text-muted-foreground">{label || "…"}</p>
              <Button
                variant="outline"
                className="w-full"
                disabled={!period || busy !== null}
                onClick={() => void download(r.type, r.file)}
              >
                <Download />
                {busy === r.type ? t("admin.preparing") : t("admin.downloadCsv")}
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      <Panel title={t("admin.yieldPerformance")} subtitle={t("admin.yieldSub", { period: label })}>
        <QueryState query={yieldReport}>{(r) => <YieldChart data={r.chart ?? []} />}</QueryState>
      </Panel>
    </>
  );
}
