import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AdminFarmer,
  AdminFarmerInput,
  AdminStats,
  AppNotification,
  CropsResponse,
  Dashboard,
  DiseaseResult,
  FertilizerPlan,
  PriceInput,
  PriceRow,
  RecordRow,
  Report,
  ReportPeriod,
  ReportType,
  Task,
  TaskInput,
  Weather,
} from "./types";

export const keys = {
  dashboard: (months: number) => ["dashboard", months] as const,
  crops: ["crops"] as const,
  savedCrops: ["saved-crops"] as const,
  weather: (location: string) => ["weather", location] as const,
  weatherLocations: ["weather-locations"] as const,
  prices: (q: string, market: string) => ["prices", q, market] as const,
  markets: ["markets"] as const,
  tasks: ["tasks"] as const,
  notifications: ["notifications"] as const,
  admin: {
    stats: ["admin", "stats"] as const,
    farmers: (q: string, status: string) => ["admin", "farmers", q, status] as const,
    records: (q: string, crop: string) => ["admin", "records", q, crop] as const,
    periods: ["admin", "periods"] as const,
    report: (type: ReportType, period: string) => ["admin", "report", type, period] as const,
  },
};

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

/* ------------------------------ farmer reads ------------------------------ */

export const useDashboard = (months: number) =>
  useQuery({
    queryKey: keys.dashboard(months),
    queryFn: () => api<Dashboard>(`/dashboard?months=${months}`),
  });

export const useCrops = (enabled = true) =>
  useQuery({ queryKey: keys.crops, queryFn: () => api<CropsResponse>("/crops"), enabled });

export const useWeather = (location: string) =>
  useQuery({
    queryKey: keys.weather(location),
    queryFn: () => api<Weather>(`/weather${location ? `?${qs({ location })}` : ""}`),
  });

export const useWeatherLocations = () =>
  useQuery({
    queryKey: keys.weatherLocations,
    queryFn: () => api<{ locations: string[] }>("/weather/locations"),
    staleTime: Infinity,
  });

export const usePrices = (q: string, market: string) =>
  useQuery({
    queryKey: keys.prices(q, market),
    queryFn: () => api<{ prices: PriceRow[] }>(`/prices?${qs({ q, market })}`),
    placeholderData: (prev) => prev, // keep rows visible while typing in the search box
  });

export const useMarkets = () =>
  useQuery({
    queryKey: keys.markets,
    queryFn: () => api<{ markets: string[] }>("/prices/markets"),
  });

export const useTasks = () =>
  useQuery({ queryKey: keys.tasks, queryFn: () => api<{ tasks: Task[] }>("/tasks") });

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<{ notifications: AppNotification[]; unread: number }>("/notifications"),
    refetchInterval: 60_000,
  });

/* ----------------------------- farmer mutations ----------------------------- */

export function useToggleSavedCrop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ crop, save }: { crop: string; save: boolean }) =>
      save
        ? api<{ crops: string[] }>("/saved-crops", { method: "POST", body: { crop } })
        : api<{ crops: string[] }>(`/saved-crops/${encodeURIComponent(crop)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.crops }),
  });
}

export const useFertilizerPlan = () =>
  useMutation({
    mutationFn: (input: { crop: string; area: number }) =>
      api<FertilizerPlan>("/fertilizer/plan", { method: "POST", body: input }),
  });

export const useDiseaseAnalysis = () =>
  useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("image", file);
      return api<DiseaseResult>("/disease/analyze", { method: "POST", form });
    },
  });

export function useTaskMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.tasks });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({
      mutationFn: (task: TaskInput) => api<{ task: Task }>("/tasks", { method: "POST", body: task }),
      onSuccess: refresh,
    }),
    toggle: useMutation({
      mutationFn: ({ id, done }: { id: number; done: boolean }) =>
        api<{ task: Task }>(`/tasks/${id}`, { method: "PATCH", body: { done } }),
      // flip the checkbox immediately, roll back if the request fails
      onMutate: async ({ id, done }) => {
        await qc.cancelQueries({ queryKey: keys.tasks });
        const previous = qc.getQueryData<{ tasks: Task[] }>(keys.tasks);
        qc.setQueryData<{ tasks: Task[] }>(keys.tasks, (old) =>
          old ? { tasks: old.tasks.map((t) => (t.id === id ? { ...t, done } : t)) } : old,
        );
        return { previous };
      },
      onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(keys.tasks, ctx.previous),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.notifications });
  return {
    markRead: useMutation({
      mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: "PATCH" }),
      onSuccess: refresh,
    }),
    markAllRead: useMutation({
      mutationFn: () => api("/notifications/read-all", { method: "POST" }),
      onSuccess: refresh,
    }),
  };
}

/* ------------------------------ prices (admin) ------------------------------ */

export function usePriceMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["prices"] });
    qc.invalidateQueries({ queryKey: keys.markets });
    qc.invalidateQueries({ queryKey: keys.admin.stats });
  };
  return {
    create: useMutation({
      mutationFn: (p: PriceInput) => api<{ price: PriceRow }>("/prices", { method: "POST", body: p }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...p }: PriceInput & { id: number }) =>
        api<{ price: PriceRow }>(`/prices/${id}`, { method: "PUT", body: p }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api<void>(`/prices/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}

/* --------------------------------- admin --------------------------------- */

export const useAdminStats = () =>
  useQuery({ queryKey: keys.admin.stats, queryFn: () => api<AdminStats>("/admin/stats") });

export const useAdminFarmers = (q: string, status: string) =>
  useQuery({
    queryKey: keys.admin.farmers(q, status),
    queryFn: () => api<{ farmers: AdminFarmer[] }>(`/admin/farmers?${qs({ q, status })}`),
    placeholderData: (prev) => prev,
  });

export function useFarmerMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  return {
    save: useMutation({
      mutationFn: ({ id, ...input }: AdminFarmerInput & { id?: number }) =>
        id
          ? api<{ farmer: AdminFarmer }>(`/admin/farmers/${id}`, { method: "PUT", body: input })
          : api<{ farmer: AdminFarmer }>("/admin/farmers", { method: "POST", body: input }),
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: number; status: "Active" | "Inactive" }) =>
        api<{ farmer: AdminFarmer }>(`/admin/farmers/${id}/status`, { method: "PATCH", body: { status } }),
      onSuccess: refresh,
    }),
  };
}

export const useAdminRecords = (q: string, crop: string) =>
  useQuery({
    queryKey: keys.admin.records(q, crop),
    queryFn: () => api<{ records: RecordRow[] }>(`/admin/records?${qs({ q, crop })}`),
    placeholderData: (prev) => prev,
  });

export function useReviewRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "Pending" | "Reviewed" }) =>
      api<{ record: RecordRow }>(`/admin/records/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export const useReportPeriods = () =>
  useQuery({
    queryKey: keys.admin.periods,
    queryFn: () => api<{ periods: ReportPeriod[] }>("/admin/report-periods"),
  });

export const useReport = (type: ReportType, period: string, enabled = true) =>
  useQuery({
    queryKey: keys.admin.report(type, period),
    queryFn: () => api<Report>(`/admin/reports/${type}?${qs({ period })}`),
    enabled: enabled && Boolean(period),
  });

/** Fetch a report on demand (for the CSV download buttons). */
export const fetchReport = (type: ReportType, period: string) =>
  api<Report>(`/admin/reports/${type}?${qs({ period })}`);
