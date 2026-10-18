import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudRain, CloudSun, Droplets, Sun } from "lucide-react";
import { PageHeading, Panel } from "@/components/common/shared";
import { QueryState } from "@/components/common/states";
import { useWeather, useWeatherLocations } from "@/api/hooks";
import { formatDate, formatNumber, formatPercent } from "@/lib/intl";
import { usePageTitle } from "@/lib/usePageTitle";

export function WeatherPage() {
  const { t } = useTranslation();
  usePageTitle(t("weather.pageTitle"));
  const [location, setLocation] = useState(""); // empty → the farmer's own location
  const weather = useWeather(location);
  const locations = useWeatherLocations();
  const selected = location || weather.data?.location || "";

  return (
    <>
      <PageHeading
        title={t("weather.title")}
        description={t("weather.subtitle")}
        action={
          <select
            aria-label={t("weather.location")}
            value={selected}
            onChange={(e) => setLocation(e.target.value)}
            className="w-36!"
          >
            {(locations.data?.locations ?? (selected ? [selected] : [])).map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        }
      />
      <QueryState query={weather}>
        {(w) => {
          const rainDay = w.advice.rain
            ? w.advice.rain.day === "today"
              ? t("weather.today")
              : formatDate(w.advice.rain.day, { weekday: "long" })
            : null;
          return (
            <>
              <div className="mb-6 grid gap-6 md:grid-cols-2">
                <Panel
                  title={t("weather.current", { place: w.location })}
                  subtitle={`${t(w.source === "live" ? "weather.liveForecast" : "weather.sampleForecast")} · ${formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" })}`}
                >
                  <div className="flex items-center gap-8 p-7">
                    <CloudSun className="text-sun" size={90} />
                    <div>
                      <div className="font-display text-5xl font-bold">{formatNumber(w.current.temp)}°C</div>
                      <p className="mt-2 text-muted-foreground">
                        {t(`weather.summary.${w.current.summary}`)} · {t("weather.feelsLike", { temp: formatNumber(w.current.feelsLike) })}
                      </p>
                    </div>
                  </div>
                  <div className="weather-metrics">
                    <div>
                      <span>{t("weather.humidity")}</span>
                      <strong>{formatPercent(w.current.humidity)}</strong>
                    </div>
                    <div>
                      <span>{t("weather.wind")}</span>
                      <strong>{t("weather.windValue", { speed: formatNumber(w.current.wind) })}</strong>
                    </div>
                    <div>
                      <span>{t("weather.uv")}</span>
                      <strong>
                        {formatNumber(w.current.uv)} · {t(`weather.uvLevel.${w.current.uvLevel}`)}
                      </strong>
                    </div>
                  </div>
                </Panel>
                <Panel title={t("weather.outlook")} subtitle={t("weather.outlookSub")}>
                  <div className="space-y-5 p-6">
                    <div className="flex gap-3">
                      <Sun className="shrink-0 text-sun" />
                      <div>
                        <h3 className="font-semibold">{t(`weather.advice.${w.advice.field}`)}</h3>
                      </div>
                    </div>
                    {rainDay && (
                      <div className="flex gap-3">
                        <CloudRain className="shrink-0 text-water" />
                        <div>
                          <h3 className="font-semibold">{t("weather.rainExpected", { day: rainDay })}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {t("weather.rainAdvice")}
                          </p>
                        </div>
                      </div>
                    )}
                    <span className="tag water">
                      {w.source === "live" ? t("weather.liveBadge") : t("weather.sampleBadge")}
                    </span>
                  </div>
                </Panel>
              </div>
              <h2 className="mb-4 font-display text-lg font-bold">{t("weather.sevenDay")}</h2>
              <div className="forecast-grid">
                {w.forecast.map((f) => (
                  <div className="panel forecast-card" key={f.date}>
                    <h3>{f.day === "Today" ? t("weather.today") : formatDate(f.date, { weekday: "short" })}</h3>
                    {f.type === "sun" ? <Sun size={33} /> : f.type === "rain" ? <CloudRain size={33} /> : <CloudSun size={33} />}
                    <strong>{formatNumber(f.temp)}°</strong>
                    <span className="ml-2 text-sm text-muted-foreground">{formatNumber(f.low)}°</span>
                    <p className="mt-3 flex justify-center gap-1">
                      <Droplets size={12} />
                      {formatPercent(f.rain)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
