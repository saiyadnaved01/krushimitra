import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="state-block" role="status" aria-live="polite">
      <div className="spinner" />
      {label ?? t("common.loading")}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message = errorMessage(t, error);
  return (
    <div className="state-block" role="alert">
      <AlertTriangle className="text-destructive" size={30} />
      <div>{message}</div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.tryAgain")}
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error states, and the children once data is available. */
export function QueryState<T>({
  query,
  children,
  label,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  label?: string;
}) {
  if (query.isPending) return <Loading {...(label ? { label } : {})} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
