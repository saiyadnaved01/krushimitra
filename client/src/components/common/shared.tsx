import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, CalendarDays, Sprout, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cropImages } from "@/lib/crop-images";
import { formatDate, formatNumber } from "@/lib/intl";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  useTranslation(); // re-render when the language changes
  const now = new Date();
  return (
    <div className="page-heading">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ?? (
        <div className="date-chip">
          <CalendarDays size={14} />
          <span>{formatDate(now, { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <div className="min-w-0">
            <h2 className="panel-title">{title}</h2>
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  title,
  value,
  unit,
  icon: Icon,
  foot,
  change,
  tone = "",
}: {
  title: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  foot: string;
  change?: number | null | undefined;
  tone?: string;
}) {
  return (
    <div className="panel stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="stat-foot">
        {change != null && (
          <span className={`trend ${change < 0 ? "down" : ""}`}>
            {change < 0 ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
            {formatNumber(Math.abs(change))}%
          </span>
        )}
        {foot}
      </div>
    </div>
  );
}

export function Trend({ value }: { value: number }) {
  return (
    <span className={`trend ${value < 0 ? "down" : ""}`}>
      {value < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {formatNumber(Math.abs(value))}%
    </span>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button[type=submit]");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel max-h-[90vh] w-full overflow-auto p-6 ${wide ? "max-w-2xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.closeDialog")}>
            ×
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Crop photo, or an icon tile for crops without a bundled photograph. */
export function CropPhoto({
  imageKey,
  alt,
  className,
}: {
  imageKey: string;
  alt: string;
  className?: string;
}) {
  const src = cropImages[imageKey];
  if (!src) {
    return (
      <div className={`crop-photo-fallback ${className ?? ""}`} role="img" aria-label={alt}>
        <Sprout size={48} />
      </div>
    );
  }
  return <img src={src} alt={alt} width={816} height={816} loading="lazy" className={className} />;
}
