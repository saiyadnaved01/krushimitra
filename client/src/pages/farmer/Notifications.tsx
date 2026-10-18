import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/common/shared";
import { QueryState } from "@/components/common/states";
import { useNotificationMutations, useNotifications } from "@/api/hooks";
import { usePageTitle } from "@/lib/usePageTitle";
import { errorMessage } from "@/lib/errors";
import { formatRelative } from "@/lib/intl";
import type { AppNotification } from "@/api/types";

/** Notifications created before translation support are matched by their original English title. */
const LEGACY_KEYS: Record<string, string> = { "Welcome to KrushiMitra": "welcome" };

function localized(t: TFunction, n: AppNotification) {
  const key = n.key ?? LEGACY_KEYS[n.title];
  return key
    ? { title: t(`notificationTexts.${key}.title`), text: t(`notificationTexts.${key}.text`) }
    : { title: n.title, text: n.text };
}

export function NotificationsPage() {
  const { t } = useTranslation();
  usePageTitle(t("notifications.pageTitle"));
  const query = useNotifications();
  const { markRead, markAllRead } = useNotificationMutations();
  const [filter, setFilter] = useState<"All" | "Unread">("All");

  return (
    <>
      <PageHeading
        title={t("notifications.title")}
        description={t("notifications.subtitle")}
        action={
          <Button
            variant="outline"
            disabled={markAllRead.isPending || !query.data?.unread}
            onClick={() =>
              markAllRead.mutate(undefined, {
                onSuccess: () => toast.success(t("notifications.allRead")),
                onError: (err) => toast.error(errorMessage(t, err)),
              })
            }
          >
            <Check />
            {t("notifications.markAll")}
          </Button>
        }
      />
      <div className="mb-5 flex gap-2">
        {(["All", "Unread"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {t(f === "All" ? "common.all" : "notifications.unread")}
            {f === "Unread" && query.data ? ` (${query.data.unread})` : ""}
          </Button>
        ))}
      </div>
      <QueryState query={query}>
        {({ notifications }) => {
          const rows = notifications.filter((n) => filter === "All" || !n.read);
          return (
            <Panel>
              {rows.map((n) => (
                <div
                  className={`flex items-start gap-4 border-b p-6 last:border-0 ${!n.read ? "bg-secondary/30" : ""}`}
                  key={n.id}
                >
                  <span className="stat-icon shrink-0">
                    <Bell size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold">{localized(t, n).title}</h2>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="my-2 text-xs leading-relaxed text-muted-foreground">{localized(t, n).text}</p>
                    <div className="flex items-center gap-3">
                      <span className="tag">{t(`notificationTypes.${n.type}`, { defaultValue: n.type })}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t("notifications.markRead")}
                    aria-label={t("notifications.markReadNamed", { title: localized(t, n).title })}
                    disabled={n.read || markRead.isPending}
                    onClick={() => markRead.mutate(n.id, { onError: (err) => toast.error(errorMessage(t, err)) })}
                  >
                    <Check />
                  </Button>
                </div>
              ))}
              {!rows.length && <div className="empty-state">{t("notifications.none")}</div>}
            </Panel>
          );
        }}
      </QueryState>
    </>
  );
}
