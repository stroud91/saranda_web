import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Award, ExternalLink } from "lucide-react";
import { CLIPS, REEL, YOUTUBE } from "../lib/media";
import { useDestinations } from "../lib/useDestinations";
import { PageHeader } from "../components/ui";

const ext = { target: "_blank", rel: "noopener noreferrer" };

export default function Credits() {
  const { name } = useDestinations();
  useEffect(() => { document.title = "Credits & licences · Saranda Companion"; }, []);
  return (
    <div className="page container narrow credits">
      <PageHeader eyebrow="Credits" icon={Award} title="Credits & licences" lead="The people and open projects whose work appears on this site — thank you." />

      <section className="card pad stack">
        <h2 className="h3">Video clips</h2>
        <p className="small muted">
          From Wikimedia Commons under <a href="https://creativecommons.org/licenses/by-sa/4.0/" {...ext}>CC BY-SA 4.0</a>.
          We edited every clip: {CLIPS[0]?.changes.toLowerCase()} Our edited versions are shared under the same licence.
          The full list of edits is in <code>scripts/edit_videos.py</code> in the site's source code.
        </p>
        <ul className="credit-list">
          {CLIPS.map((c) => (
            <li key={c.key}>
              <img src={c.src.thumb} alt="" loading="lazy" width="96" height="54" />
              <div>
                <b>{c.title}</b> <span className="tiny muted">· <Link to={`/explore/${c.place}`}>{name(c.place)}</Link></span>
                <div className="small">
                  by <a href={c.author_url} {...ext}>{c.author}</a> · <a href={c.source} {...ext}>original on Wikimedia Commons <ExternalLink size={11} /></a> · <a href={c.license.url} {...ext} rel="noopener noreferrer license">{c.license.name}</a> · edited
                </div>
              </div>
            </li>
          ))}
        </ul>
        {REEL && <p className="small">The “Albania in motion” montage combines the edited clips above ({REEL.changes.toLowerCase()}) and is shared under {REEL.license.name}.</p>}
      </section>

      <section className="card pad stack">
        <h2 className="h3">Films on YouTube</h2>
        <p className="small muted">Shown with YouTube's own embedded player and only loaded when you press play. All rights stay with their creators.</p>
        <ul className="plain-list small">
          {YOUTUBE.map((v) => (
            <li key={v.id}><a href={`https://www.youtube.com/watch?v=${v.id}`} {...ext}>{v.title}</a>{v.channel ? ` — @${v.channel}` : ""}</li>
          ))}
        </ul>
      </section>

      <section className="card pad stack">
        <h2 className="h3">Maps, data & graphics</h2>
        <ul className="plain-list small">
          <li>Map data © <a href="https://www.openstreetmap.org/copyright" {...ext}>OpenStreetMap contributors</a> (ODbL).</li>
          <li>Country outlines for the 3D atlas: <a href="https://www.naturalearthdata.com/" {...ext}>Natural Earth</a> (public domain), via the <a href="https://github.com/topojson/world-atlas" {...ext}>world-atlas</a> package.</li>
          <li>Weather and sea temperature: <a href="https://open-meteo.com/" {...ext}>Open-Meteo.com</a> (CC BY 4.0).</li>
          <li>Exchange rates: <a href="https://www.exchangerate-api.com" {...ext}>Rates by Exchange Rate API</a>.</li>
          <li>Road routing: <a href="https://project-osrm.org/" {...ext}>OSRM</a> on OpenStreetMap data.</li>
          <li>The ocean, illustrations and sea sound are generated in your browser by this site's own code.</li>
        </ul>
      </section>
    </div>
  );
}
