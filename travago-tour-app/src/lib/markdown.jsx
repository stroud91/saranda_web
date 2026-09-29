// Minimal, safe markdown → React (bold, italics, bullet lists, paragraphs, links to
// same-site paths only — `//host` and `/\host` are rejected). Everything else is rendered as text: no HTML injection possible.
import { Fragment } from "react";
import { Link } from "react-router-dom";

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(\/(?![/\\])[^)\s]*\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\((\/(?![/\\])[^)\s]*)\)/);
      out.push(<Link key={key} to={href}>{label}</Link>);
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }) {
  const blocks = String(text || "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•*]\s+/.test(l) || !l.trim());
        if (isList) {
          return (
            <ul key={bi}>
              {lines.filter((l) => l.trim()).map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-•*]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {/^\s*[-•*]\s+/.test(l) ? <>• {inline(l.replace(/^\s*[-•*]\s+/, ""), `${bi}-${li}`)}</> : inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
