import { Download } from "lucide-react";
import { useApiMode } from "../../lib/useApi";
import { downloadTripCalendar } from "../../lib/api";
import { toast } from "../ui";
import { tr } from "../../i18n";

/** Calendar export: the API's .ics endpoint, or built in the browser on static hosting. */
export default function CalendarButton({ trip, shareId, children, className = "btn" }) {
  const mode = useApiMode();
  if (mode === "server" && shareId) {
    return <a className={className} href={`/api/trips/${shareId}/calendar.ics`}><Download size={16} /> {children}</a>;
  }
  const save = () => downloadTripCalendar(trip, shareId).catch(() => toast(tr("Couldn't create the calendar file")));
  return <button type="button" className={className} onClick={save} disabled={!mode}><Download size={16} /> {children}</button>;
}
