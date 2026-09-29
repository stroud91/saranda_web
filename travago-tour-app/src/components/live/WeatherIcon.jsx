import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Moon } from "lucide-react";

const ICONS = { sun: Sun, "cloud-sun": CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };

export default function WeatherIcon({ icon, isDay = true, size = 20 }) {
  const Icon = icon === "sun" && !isDay ? Moon : ICONS[icon] || Cloud;
  return <Icon size={size} />;
}
