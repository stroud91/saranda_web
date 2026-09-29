// Map tile provider. Defaults to OpenStreetMap's free standard tiles
// (attribution required; light use per the OSM tile usage policy).
// Set VITE_MAP_TILES=carto once you have a CARTO licence for commercial use,
// or VITE_MAP_TILES=<https URL template> for any other provider.
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const PROVIDERS = {
  osm: {
    light: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    dark: null, // no official dark style: darkened with a CSS filter instead
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  carto: {
    light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    subdomains: "abcd",
    maxZoom: 18,
  },
};

export function tileConfig(dark) {
  const choice = (import.meta.env.VITE_MAP_TILES || "osm").trim();
  const p = PROVIDERS[choice] || { light: choice, dark: null, attribution: OSM_ATTRIBUTION, maxZoom: 18 };
  return {
    url: dark && p.dark ? p.dark : p.light,
    filterDark: dark && !p.dark,
    attribution: p.attribution,
    subdomains: p.subdomains || "abc",
    maxZoom: p.maxZoom,
  };
}
