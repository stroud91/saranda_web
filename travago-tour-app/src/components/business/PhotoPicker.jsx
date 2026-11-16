import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { uploadPhoto } from "../../lib/api";
import { MAX_MB, MAX_PHOTOS, PHOTO_TYPES, shrink, thumb } from "../../lib/photos";
import { tr } from "../../i18n";

/**
 * Photos for one listing: add, reorder, remove. The first photo is the cover.
 * `onChange` takes a function (list) => list, because uploads finish one by one
 * while the rest of the form may be changing.
 */
export default function PhotoPicker({ value = [], onChange, scope = "business", max = MAX_PHOTOS, error }) {
  const input = useRef(null);
  const [state, setState] = useState({ total: 0, done: 0, error: "" });
  const busy = state.total > 0;

  const add = async (files) => {
    const picked = [...files].slice(0, Math.max(0, max - value.length));
    let problem = files.length > picked.length ? tr("A listing can have up to {max} photos.", { max }) : "";
    setState({ total: picked.length, done: 0, error: "" });
    for (const [i, file] of picked.entries()) {
      try {
        if (!PHOTO_TYPES.includes(file.type)) throw new Error(tr("“{name}” isn't a JPEG, PNG or WebP photo.", { name: file.name }));
        const small = await shrink(file);
        if (small.size > MAX_MB * 1024 * 1024) throw new Error(tr("“{name}” is over {mb} MB. Choose a smaller photo.", { name: file.name, mb: MAX_MB }));
        const saved = await uploadPhoto(small, scope);
        onChange((list) => (list.includes(saved.url) ? list : [...list, saved.url]));
      } catch (e) {
        problem = e.message;
      }
      setState((s) => ({ ...s, done: i + 1 }));
    }
    setState({ total: 0, done: 0, error: problem });
    if (input.current) input.current.value = ""; // picking the same file again should work
  };
  const move = (from, to) => onChange((list) => {
    const next = [...list];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  });
  const remove = (url) => onChange((list) => list.filter((u) => u !== url));

  return (
    <div className={`field ${error ? "error" : ""}`}>
      <span className="label">{tr("Photos")} <span className="muted">({value.length}/{max})</span></span>
      <ul className="photo-grid">
        {value.map((url, i) => (
          <li key={url} className="photo-tile">
            <img src={thumb(url)} alt={tr("Photo {n}", { n: i + 1 })} loading="lazy" />
            {i === 0 && <span className="badge glass photo-cover">{tr("Cover")}</span>}
            <div className="photo-tools">
              <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={tr("Move photo {n} earlier", { n: i + 1 })}><ArrowLeft size={15} /></button>
              <button type="button" className="icon-btn sm" disabled={i === value.length - 1} onClick={() => move(i, i + 1)} aria-label={tr("Move photo {n} later", { n: i + 1 })}><ArrowRight size={15} /></button>
              <button type="button" className="icon-btn sm" onClick={() => remove(url)} aria-label={tr("Remove photo {n}", { n: i + 1 })}><Trash2 size={15} /></button>
            </div>
          </li>
        ))}
        {value.length < max && (
          <li>
            <button type="button" className="photo-add" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <><span className="spinner" /> {tr("Uploading {done} of {total}…", { done: Math.min(state.done + 1, state.total), total: state.total })}</> : <><ImagePlus size={22} /> {tr("Add photos")}</>}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} multiple hidden onChange={(e) => add(e.target.files)} aria-label={tr("Add photos")} />
      {(state.error || error) && <span className="field-error" role="alert">{state.error || error}</span>}
      <span className="tiny muted">{tr("JPEG, PNG or WebP. The first photo is the one guests see on cards; use the arrows to change the order.")}</span>
    </div>
  );
}
