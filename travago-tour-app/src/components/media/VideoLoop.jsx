import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { prefersReducedMotion, saveData } from "../../lib/media";

/**
 * Muted looping clip that only downloads and plays while on screen.
 * Reduced-motion or data-saver visitors get the poster frame instead.
 */
const VideoLoop = forwardRef(function VideoLoop({ clip, src, poster, className = "", eager = false, onTime, label, ...rest }, ref) {
  const v = useRef(null);
  const [still] = useState(() => prefersReducedMotion() || saveData());
  const [near, setNear] = useState(eager);
  const visible = useRef(false);
  const file = src || clip?.src?.mp4;
  const image = poster || clip?.src?.poster;
  useImperativeHandle(ref, () => v.current, []);

  useEffect(() => {
    const el = v.current;
    if (!el || still) return undefined;
    // iOS needs the muted *attribute* (React only sets the property) to allow autoplay.
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      if (e.isIntersecting) {
        setNear(true);
        if (el.getAttribute("src")) el.play?.().catch(() => {});
      } else {
        el.pause?.();
      }
    }, { rootMargin: "200px 0px", threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);

  // Start as soon as the source is attached, if the clip is still on screen.
  useEffect(() => {
    const el = v.current;
    if (!el || !near || still) return undefined;
    const start = () => visible.current && el.paused && el.play?.().catch(() => {});
    el.addEventListener("canplay", start);
    start();
    return () => el.removeEventListener("canplay", start);
  }, [near, still]);

  useEffect(() => {
    const el = v.current;
    if (!el || !onTime) return undefined;
    const fn = () => onTime(el.currentTime, el.duration);
    el.addEventListener("timeupdate", fn);
    return () => el.removeEventListener("timeupdate", fn);
  }, [onTime]);

  if (still) return <img className={`video-loop ${className}`} src={image} alt={label || clip?.title || ""} loading="lazy" decoding="async" {...rest} />;
  return (
    <video
      ref={v}
      className={`video-loop ${className}`}
      muted
      loop
      playsInline
      autoPlay={near}
      preload={near ? "auto" : "none"}
      poster={image}
      aria-label={label || clip?.title}
      src={near ? file : undefined}
      disablePictureInPicture
      {...rest}
    />
  );
});

export default VideoLoop;
