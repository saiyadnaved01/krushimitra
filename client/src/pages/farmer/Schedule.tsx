import { useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { addDays, addMonths, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, PageHeading, Panel } from "@/components/common/shared";
import { QueryState } from "@/components/common/states";
import { useTaskMutations, useTasks } from "@/api/hooks";
import type { TaskCategory } from "@/api/types";
import { todayISO } from "@/lib/format";
import { cropLabel, CROP_KEYS, taskCropLabel } from "@/lib/cropLabel";
import { errorMessage } from "@/lib/errors";
import { formatClock, formatDate, formatMonthYear, formatNumber, formatShortDate, weekdayNames } from "@/lib/intl";
import { usePageTitle } from "@/lib/usePageTitle";

const CATEGORIES: TaskCategory[] = ["Irrigation", "Fertilizer", "Inspection", "Harvest"];

export function SchedulePage() {
  const { t } = useTranslation();
  usePageTitle(t("schedule.pageTitle"));
  const tasksQuery = useTasks();
  const { create, toggle, remove } = useTaskMutations();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dialog, setDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [crop, setCrop] = useState("rice");
  const [field, setField] = useState("");
  const [category, setCategory] = useState<TaskCategory>("Irrigation");
  const [time, setTime] = useState("07:00");

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const today = todayISO();
  const cropKeys = [...CROP_KEYS].sort((a, b) => cropLabel(t, a).localeCompare(cropLabel(t, b)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        title: title.trim(),
        date,
        time,
        category,
        crop: field.trim() ? `${crop[0]?.toUpperCase()}${crop.slice(1)} • ${field.trim()}` : `${crop[0]?.toUpperCase()}${crop.slice(1)}`,
      });
      toast.success(t("schedule.added"));
      setDialog(false);
      setTitle("");
      setField("");
      setMonth(startOfMonth(parseISO(date))); // jump to the month that now holds the task
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  async function onDelete(id: number) {
    try {
      await remove.mutateAsync(id);
      toast.success(t("schedule.removed"));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  return (
    <>
      <PageHeading
        title={t("schedule.title")}
        description={t("schedule.subtitle")}
        action={
          <Button onClick={() => setDialog(true)}>
            <Plus />
            {t("schedule.addTask")}
          </Button>
        }
      />
      <QueryState query={tasksQuery}>
        {({ tasks }) => (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Panel
              title={formatMonthYear(month)}
              action={
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("schedule.prevMonth")}
                    onClick={() => setMonth(addMonths(month, -1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
                    {t("schedule.today")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("schedule.nextMonth")}
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              }
            >
              <div className="calendar-grid mt-3 overflow-hidden rounded-b-lg">
                {weekdayNames().map((d) => (
                  <div className="calendar-weekday" key={d}>
                    {d}
                  </div>
                ))}
                {Array.from({ length: 42 }, (_, i) => {
                  const day = addDays(start, i);
                  const key = format(day, "yyyy-MM-dd");
                  return (
                    <div
                      key={key}
                      className={`calendar-day ${!isSameMonth(day, month) ? "muted" : ""} ${key === today ? "today" : ""}`}
                    >
                      <span className="text-xs">{formatNumber(day.getDate())}</span>
                      {tasks
                        .filter((task) => task.date === key)
                        .map((task) => (
                          <div
                            className={`calendar-event ${task.done ? "line-through opacity-50" : ""}`}
                            key={task.id}
                            title={`${task.title} · ${formatClock(task.time)}`}
                          >
                            {task.title}
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel
              title={t("schedule.upcoming")}
              subtitle={t("schedule.remaining", { count: tasks.filter((x) => !x.done).length })}
            >
              {tasks.map((task) => (
                <div className="task-row" key={task.id}>
                  <input
                    aria-label={t("schedule.complete", { title: task.title })}
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      toggle.mutate(
                        { id: task.id, done: !task.done },
                        { onError: (err) => toast.error(err.message) },
                      )
                    }
                  />
                  <div className="min-w-0">
                    <h4 className={task.done ? "line-through opacity-50" : ""}>{task.title}</h4>
                    <p>
                      {formatShortDate(task.date)} · {formatClock(task.time)}
                    </p>
                    <p className="mt-1!">{taskCropLabel(t, task.crop)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("schedule.deleteNamed", { title: task.title })}
                    disabled={remove.isPending}
                    onClick={() => void onDelete(task.id)}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {!tasks.length && <div className="empty-state">{t("schedule.none")}</div>}
            </Panel>
          </div>
        )}
      </QueryState>
      {dialog && (
        <Dialog title={t("schedule.dialogTitle")} onClose={() => setDialog(false)}>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <label>
              {t("schedule.fieldName")}
              <input
                required
                minLength={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("schedule.namePlaceholder")}
              />
            </label>
            <div className="form-grid">
              <label>
                {t("schedule.fieldDate")}
                <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                {t("schedule.fieldTime")}
                <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label>
                {t("schedule.fieldCrop")}
                <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                  {cropKeys.map((c) => (
                    <option key={c} value={c}>
                      {cropLabel(t, c)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("schedule.fieldCategory")}
                <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {t("schedule.fieldField")} <span className="text-muted-foreground">({t("common.optional")})</span>
              <input
                value={field}
                maxLength={40}
                onChange={(e) => setField(e.target.value)}
                placeholder={t("schedule.fieldPlaceholder")}
              />
            </label>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? t("schedule.adding") : t("schedule.addTask")}
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
