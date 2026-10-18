import { useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, PageHeading, Panel } from "@/components/common/shared";
import { ErrorState, Loading } from "@/components/common/states";
import { useAdminRecords, useReviewRecord } from "@/api/hooks";
import type { RecordRow } from "@/api/types";
import { downloadCSV } from "@/lib/csv";
import { cropLabel } from "@/lib/cropLabel";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatShortDate } from "@/lib/intl";
import { useDebounced } from "@/lib/useDebounced";
import { usePageTitle } from "@/lib/usePageTitle";

// Admins can't call the farmer-only crops endpoint, so the filter list is fixed to the catalogue.
// Stored records use the English crop name.
const CROPS = ["Chickpea", "Cotton", "Groundnut", "Maize", "Onion", "Rice", "Soybean", "Sugarcane", "Tomato", "Wheat"];

export function RecordsPage() {
  const { t } = useTranslation();
  usePageTitle(t("admin.recordsTitle"));
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("All crops");
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const q = useDebounced(query.trim());
  const records = useAdminRecords(q, crop);
  const review = useReviewRecord();
  const rows = records.data?.records ?? [];

  async function setStatus(r: RecordRow, status: RecordRow["status"]) {
    try {
      const { record } = await review.mutateAsync({ id: r.recordId, status });
      setSelected(record);
      toast.success(t(status === "Reviewed" ? "admin.markedReviewed" : "admin.movedPending"));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  return (
    <>
      <PageHeading
        title={t("admin.recordsHeading")}
        description={t("admin.recordsSub")}
        action={
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() =>
              downloadCSV(
                "recommendation-records.csv",
                rows.map(({ recordId: _recordId, ...r }) => r),
              )
            }
          >
            <Download />
            {t("admin.exportRecords")}
          </Button>
        }
      />
      <div className="filters">
        <input
          aria-label={t("admin.searchFarmer")}
          placeholder={t("admin.searchFarmer")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label={t("admin.filterCrop")}
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
        >
          <option value="All crops">{t("admin.allCrops")}</option>
          {CROPS.map((c) => (
            <option key={c} value={c}>
              {cropLabel(t, c)}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{t("admin.recordCount", { count: rows.length })}</span>
      </div>
      <Panel>
        {records.isPending ? (
          <Loading />
        ) : records.isError ? (
          <ErrorState error={records.error} onRetry={() => records.refetch()} />
        ) : (
          <>
            <div className="table-scroll">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>{t("admin.colRecordId")}</th>
                    <th>{t("admin.colFarmer")}</th>
                    <th>{t("admin.colCrop")}</th>
                    <th>{t("admin.colMatch")}</th>
                    <th>{t("admin.colDate")}</th>
                    <th>{t("admin.colStatus")}</th>
                    <th>{t("admin.colReview")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.farmer}</td>
                      <td>{cropLabel(t, r.crop)}</td>
                      <td>{formatNumber(r.match)}%</td>
                      <td>{formatShortDate(r.date)}</td>
                      <td>
                        <span className={`tag ${r.status === "Pending" ? "sun" : ""}`}>{t(`status.${r.status}`)}</span>
                      </td>
                      <td>
                        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                          {t("common.view")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <div className="empty-state">{t("admin.noMatchRecords")}</div>}
          </>
        )}
      </Panel>
      {selected && (
        <Dialog title={selected.id} onClose={() => setSelected(null)}>
          <dl className="detail-list">
            <div>
              <dt>{t("admin.colFarmer")}</dt>
              <dd>{selected.farmer}</dd>
            </div>
            <div>
              <dt>{t("admin.colCrop")}</dt>
              <dd>{cropLabel(t, selected.crop)}</dd>
            </div>
            <div>
              <dt>{t("profile.soil")}</dt>
              <dd>{t(`soil.${selected.soil}`, { defaultValue: selected.soil })}</dd>
            </div>
            <div>
              <dt>{t("admin.colMatch")}</dt>
              <dd>{formatNumber(selected.match)}%</dd>
            </div>
            <div>
              <dt>{t("admin.savedOn")}</dt>
              <dd>{formatShortDate(selected.date)}</dd>
            </div>
            <div>
              <dt>{t("admin.colStatus")}</dt>
              <dd>{t(`status.${selected.status}`)}</dd>
            </div>
          </dl>
          <Button
            className="mt-5 w-full"
            variant={selected.status === "Pending" ? "default" : "outline"}
            disabled={review.isPending}
            onClick={() => void setStatus(selected, selected.status === "Pending" ? "Reviewed" : "Pending")}
          >
            {t(selected.status === "Pending" ? "admin.markReviewed" : "admin.moveBack")}
          </Button>
        </Dialog>
      )}
    </>
  );
}
