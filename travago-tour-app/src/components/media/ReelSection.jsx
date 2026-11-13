import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clapperboard, Film, Maximize2, Play } from "lucide-react";
import { CLIPS, REEL, YOUTUBE, clipByKey } from "../../lib/media";
import { useDestinations } from "../../lib/useDestinations";
import VideoLoop from "./VideoLoop";
import YouTubeFacade from "./YouTubeFacade";
import { tr } from "../../i18n";

const Stories = lazy(() => import("./Stories"));

export default function ReelSection() {
  const { name, bySlug } = useDestinations();
  const reel = useRef(null);
  const [chapter, setChapter] = useState(0);
  const [story, setStory] = useState(null);
  const chapters = REEL?.chapters || [];

  const onTime = useCallback((t) => {
    let k = 0;
    for (let j = 0; j < chapters.length; j++) if (t >= chapters[j].start) k = j;
    setChapter((c) => (c === k ? c : k));
  }, [chapters]);

  if (!REEL && !CLIPS.length) return null;
  const jump = (k) => {
    const v = reel.current;
    if (v && v.tagName === "VIDEO") {
      v.currentTime = chapters[k].start + 0.05;
      v.play?.().catch(() => {});
    }
    setChapter(k);
  };
  const current = clipByKey[chapters[chapter]?.key];

  return (
    <section className="section container reel-section" aria-labelledby="reel-title">
      <div className="section-head">
        <div>
          <div className="eyebrow"><Film size={14} /> {tr("Albania in motion")}</div>
          <h2 id="reel-title">{tr("See it before you go")}</h2>
          <p className="muted">{tr("Short films from the riviera, the mountains and the old stone towns — tap one to watch it full screen.")}</p>
        </div>
      </div>

      <div className="reel-grid">
        {REEL && (
          <motion.div className="reel-stage" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}>
            <VideoLoop ref={reel} src={REEL.src.mp4} poster={REEL.src.poster} className="reel-video" onTime={onTime} label={tr("Montage of places in Albania")} />
            <div className="reel-glow" aria-hidden="true" />
            <div className="reel-hud">
              <span className="reel-rec" aria-hidden="true" />
              <div className="reel-now">
                <span className="tiny">{tr("Now showing")}</span>
                <b>{current?.title}</b>
              </div>
              <button type="button" className="icon-btn sm" onClick={() => setStory(Math.max(0, CLIPS.findIndex((c) => c.key === current?.key)))} aria-label={tr("Watch full screen")}>
                <Maximize2 size={16} />
              </button>
            </div>
            <div className="reel-chapters" role="tablist" aria-label={tr("Places in this film")}>
              {chapters.map((c, k) => (
                <button key={c.key} type="button" role="tab" aria-selected={k === chapter} className={`chip ${k === chapter ? "on" : ""}`} onClick={() => jump(k)}>
                  {clipByKey[c.key]?.short || clipByKey[c.key]?.title}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="story-rail" role="list" aria-label={tr("Video stories")}>
          {CLIPS.map((c, k) => (
            <motion.button
              type="button"
              role="listitem"
              key={c.key}
              className="story-card"
              onClick={() => setStory(k)}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: k * 0.05 }}
            >
              <span className="story-thumb"><img src={c.src.thumb} alt="" loading="lazy" decoding="async" /><Play size={14} fill="currentColor" /></span>
              <span className="story-text">
                <b>{c.title}</b>
                <span className="tiny muted">{name(c.place)} · {Math.round(c.seconds)}s</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="section-head yt-head">
        <div>
          <div className="eyebrow"><Clapperboard size={14} /> {tr("Sarandë on film")}</div>
          <h3>{tr("Favourite films by travellers and drone pilots")}</h3>
        </div>
      </div>
      <div className="yt-grid">
        {YOUTUBE.slice(0, 4).map((v) => <YouTubeFacade key={v.id} video={v} scene={bySlug[v.place]?.scene} />)}
      </div>
      <details className="yt-more">
        <summary className="btn ghost sm">{tr("More films")}</summary>
        <div className="yt-grid">
          {YOUTUBE.slice(4).map((v) => <YouTubeFacade key={v.id} video={v} scene={bySlug[v.place]?.scene} />)}
        </div>
      </details>
      <p className="tiny faint reel-credits">Clips: Wikimedia Commons contributors, CC BY-SA 4.0, edited by us. <Link to="/credits">Video credits & licences</Link></p>

      {story !== null && (
        <Suspense fallback={null}>
          <Stories items={CLIPS} start={story} onClose={() => setStory(null)} placeName={name} />
        </Suspense>
      )}
    </section>
  );
}
