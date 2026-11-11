import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";
import SceneArt from "../art/SceneArt";

/**
 * Click-to-load YouTube: until the guest presses play nothing is requested
 * from YouTube/Google (no cookies, no tracking, no heavy player script).
 */
export default function YouTubeFacade({ video, scene = "coast" }) {
  const [on, setOn] = useState(false);
  const url = `https://www.youtube.com/watch?v=${video.id}`;
  if (on) {
    return (
      <div className="yt-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="yt-card">
      <button type="button" className="yt-facade" onClick={() => setOn(true)} aria-label={`Play “${video.title}” (loads YouTube)`}>
        <SceneArt scene={scene} seed={video.id} />
        <span className="yt-play"><Play size={26} fill="currentColor" /></span>
        <span className="yt-title">{video.title}</span>
      </button>
      <div className="yt-meta tiny">
        <span>{video.channel ? `@${video.channel} · ` : ""}YouTube · plays from YouTube when pressed</span>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open “${video.title}” on YouTube`}><ExternalLink size={13} /></a>
      </div>
    </div>
  );
}
