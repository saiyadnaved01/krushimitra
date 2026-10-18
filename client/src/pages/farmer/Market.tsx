import { useState, type FormEvent } from "react";
import { Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, PageHeading, Panel, Trend } from "@/components/common/shared";
import { ErrorState, Loading } from "@/components/common/states";
import { useMarkets, usePriceMutations, usePrices } from "@/api/hooks";
import type { PriceRow } from "@/api/types";
import { downloadCSV } from "@/lib/csv";
import { todayISO } from "@/lib/format";
import { cropLabel } from "@/lib/cropLabel";
import { errorMessage } from "@/lib/errors";
import { formatRupees, formatShortDate } from "@/lib/intl";
import { useDebounced } from "@/lib/useDebounced";
import { usePageTitle } from "@/lib/usePageTitle";

type Draft = { id?: number; crop: string; variety: string; market: string; price: string; date: string };

const emptyDraft = (market: string): Draft => ({
  crop: "",
  variety: "",
  market,
  price: "",
  date: todayISO(),
});

export function MarketPage({ admin = false }: { admin?: boolean }) {
  const { t } = useTranslation();
  usePageTitle(t(admin ? "market.adminTitle" : "market.pageTitle"));
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("All markets");
  const [draft, setDraft] = useState<Draft | null>(null);
  const q = useDebounced(query.trim());
  const prices = usePrices(q, market);
  const markets = useMarkets();
  const mutations = usePriceMutations();
  const rows = prices.data?.prices ?? [];
  const marketOptions = markets.data?.markets ?? [];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const { id, price, ...rest } = draft;
    const input = { ...rest, price: Number(price) };
    try {
      if (id) await mutations.update.mutateAsync({ id, ...input });
      else await mutations.create.mutateAsync(input);
      toast.success(t(id ? "market.updated" : "market.added"));
      setDraft(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  async function remove(p: PriceRow) {
    if (!window.confirm(t("market.confirmDelete", { crop: cropLabel(t, p.crop), variety: p.variety, market: p.market }))) return;
    try {
      await mutations.remove.mutateAsync(p.id);
      toast.success(t("market.deleted"));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  const latest = rows.reduce((d, p) => (p.date > d ? p.date : d), "");

  return (
    <>
      <PageHeading
        title={t(admin ? "market.adminTitle" : "market.title")}
        description={`${t("market.subtitle")}${latest ? ` · ${t("market.updatedOn", { date: formatShortDate(latest) })}` : ""}`}
        action={
          <div className="flex gap-2">
            {admin && (
              <Button onClick={() => setDraft(emptyDraft(marketOptions[0] ?? "Pune APMC"))}>
                <Plus />
                {t("market.addPrice")}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!rows.length}
              onClick={() => downloadCSV("market-prices.csv", rows as unknown as Record<string, unknown>[])}
            >
              <Download />
              {t("market.export")}
            </Button>
          </div>
        }
      />
      <div className="filters">
        <input
          placeholder={t("market.search")}
          aria-label={t("market.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label={t("market.filterMarket")} value={market} onChange={(e) => setMarket(e.target.value)}>
          <option value="All markets">{t("market.allMarkets")}</option>
          {marketOptions.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{t("market.count", { count: rows.length })}</span>
      </div>
      <Panel>
        {prices.isPending ? (
          <Loading />
        ) : prices.isError ? (
          <ErrorState error={prices.error} onRetry={() => prices.refetch()} />
        ) : (
          <>
            <div className="table-scroll">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>{t("market.colCropVariety")}</th>
                    <th>{t("market.colMarket")}</th>
                    <th>{t("market.colPricePerQuintal")}</th>
                    <th>{t("market.colChange")}</th>
                    <th>{t(admin ? "market.colManage" : "market.colUpdated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{cropLabel(t, p.crop)}</strong>
                        <div className="mt-1 text-muted-foreground">{p.variety}</div>
                      </td>
                      <td>{p.market}</td>
                      <td className="font-semibold">{formatRupees(p.price)}</td>
                      <td>
                        <Trend value={p.change} />
                      </td>
                      <td>
                        {admin ? (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDraft({ ...p, price: String(p.price) })}
                            >
                              {t("market.editPrice")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => void remove(p)}
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        ) : (
                          formatShortDate(p.date)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <div className="empty-state">{t("market.none")}</div>}
          </>
        )}
      </Panel>
      <p className="mt-5 text-xs text-muted-foreground">
        {t("market.disclaimer")}
      </p>
      {draft && (
        <Dialog
          title={draft.id ? t("market.dialogUpdate", { crop: cropLabel(t, draft.crop) }) : t("market.dialogAdd")}
          onClose={() => setDraft(null)}
        >
          <form className="space-y-4" onSubmit={(e) => void save(e)}>
            <div className="form-grid">
              <label>
                {t("market.fieldCrop")}
                <input
                  required
                  minLength={2}
                  value={draft.crop}
                  onChange={(e) => setDraft({ ...draft, crop: e.target.value })}
                />
              </label>
              <label>
                {t("market.fieldVariety")}
                <input
                  required
                  value={draft.variety}
                  onChange={(e) => setDraft({ ...draft, variety: e.target.value })}
                />
              </label>
            </div>
            <label>
              {t("market.fieldPrice")}
              <input
                required
                type="number"
                min="1"
                step="1"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </label>
            <label>
              {t("market.colMarket")}
              <select value={draft.market} onChange={(e) => setDraft({ ...draft, market: e.target.value })}>
                {[...new Set([...marketOptions, draft.market])].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              {t("market.fieldDate")}
              <input
                required
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <Button
              type="submit"
              className="w-full"
              disabled={mutations.update.isPending || mutations.create.isPending}
            >
              {t("market.save")}
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
