import { Waves, Wind, Thermometer, Sunset } from "lucide-react";
import { useApi } from "../../lib/useApi";
import { fmtDate } from "../../lib/format";
import WeatherIcon from "./WeatherIcon";
import { Skeleton } from "../ui";
import { tr } from "../../i18n";

const r = (n) => (n === null || n === undefined ? "–" : Math.round(n));

export function WeatherChip({ place = "sarande" }) {
  const { data } = useApi(`/live/weather?place=${place}`);
  if (!data) return <span className="live-chip"><span className="spinner" style={{ width: 14, height: 14 }} /> {tr("Loading weather")}</span>;
  const c = data.current;
  return (
    <span className="live-chip" title={data.source}>
      <WeatherIcon icon={c.icon} isDay={c.is_day} size={16} />
      <b>{r(c.temp)}°</b> {data.place.name || "Sarandë"}
      {c.sea_temp != null && <><span className="dot" /> <Waves size={14} /> {tr("sea")} <b>{r(c.sea_temp)}°</b></>}
      {!data.live && <span className="tiny" style={{ opacity: 0.8 }}>{tr("· typical")}</span>}
    </span>
  );
}

export function WeatherCard({ place = "sarande", compact = false }) {
  const { data, loading } = useApi(`/live/weather?place=${place}`);
  if (loading || !data) return <Skeleton h={compact ? 120 : 220} r={26} />;
  const c = data.current;
  return (
    <div className={`weather-card ${compact ? "compact" : ""}`}>
      <div className="weather-now">
        <div className="weather-icon-lg"><WeatherIcon icon={c.icon} isDay={c.is_day} size={40} /></div>
        <div>
          <div className="weather-temp">{r(c.temp)}°</div>
          <div className="weather-label">{c.label}</div>
        </div>
        <div className="weather-meta">
          {c.sea_temp != null && <span><Waves size={14} /> Sea {r(c.sea_temp)}°C</span>}
          {c.wave_height != null && <span><Waves size={14} /> Waves {c.wave_height} m</span>}
          {c.wind_kmh != null && <span><Wind size={14} /> {r(c.wind_kmh)} km/h</span>}
          {c.feels_like != null && <span><Thermometer size={14} /> Feels {r(c.feels_like)}°</span>}
        </div>
      </div>
      {!compact && data.daily?.length > 0 && (
        <div className="forecast">
          {data.daily.map((d) => (
            <div key={d.date} className="forecast-day">
              <span className="tiny">{fmtDate(d.date, { weekday: "short" })}</span>
              <WeatherIcon icon={d.icon} size={20} />
              <b>{r(d.max)}°</b>
              <span className="tiny muted">{r(d.min)}°</span>
              {d.rain_chance > 30 && <span className="tiny rain">{d.rain_chance}%</span>}
            </div>
          ))}
        </div>
      )}
      {!compact && data.daily?.[0]?.sunset && (
        <div className="tiny muted row" style={{ gap: 6, marginTop: 10 }}><Sunset size={14} /> Sunset today {data.daily[0].sunset}</div>
      )}
      <div className="tiny faint" style={{ marginTop: 8 }}>
        {data.live ? <>Live · <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a></> : `Typical for this month in Sarandë (${data.typical?.air_high}° air / ${data.typical?.sea}° sea)`}
      </div>
    </div>
  );
}
