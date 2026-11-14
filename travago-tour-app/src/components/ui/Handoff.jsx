import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { tr } from "../../i18n";

/**
 * Static hosting has no server to store a request, so the request is turned
 * into a ready-made message the guest sends themselves (WhatsApp or email).
 */
export default function Handoff({ handoff, title = "Your request is ready to send" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${handoff.subject}\n\n${handoff.summary}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the text stays selectable below */
    }
  };
  return (
    <div className="handoff stack" role="status">
      <div className="row gap-sm"><Send size={18} aria-hidden="true" /><h3 className="mb-0">{title}</h3></div>
      <p className="small muted">{tr("Nothing has been sent yet. Choose how to send it — your message opens pre-filled, so just press send.")}</p>
      <pre className="handoff-summary">{handoff.summary}</pre>
      <div className="row wrap gap-sm">
        {handoff.whatsapp_url && <a className="btn whatsapp" href={handoff.whatsapp_url} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> {tr("Send on WhatsApp")}</a>}
        {handoff.mailto_url && <a className="btn primary" href={handoff.mailto_url}><Mail size={16} /> {tr("Send by email")}</a>}
        <button type="button" className="btn" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? tr("Copied") : tr("Copy details")}</button>
      </div>
      {!handoff.whatsapp_url && !handoff.mailto_url && <p className="tiny muted">{tr("Copy the details and send them to us by email or phone.")}</p>}
    </div>
  );
}
