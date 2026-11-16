import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { api } from "../../lib/api";
import { Alert } from "../ui";
import { locale, tr } from "../../i18n";

/**
 * What the hourly check found (`flask monitor check`): a failed backup, a calendar
 * that stopped updating, a full disk… and when the last backup was made. Guests
 * waiting for an answer are already listed below, so they aren't repeated here.
 */
export default function SiteHealth() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/admin/health", { cacheable: false }).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  const problems = data.problems.filter((p) => p.level === "problem");
  const when = data.backup && new Date(data.backup.at).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="site-health stack" style={{ "--gap": "8px" }}>
      {problems.length > 0 && (
        <Alert kind="warn">
          <b>{tr("The site needs your attention")}</b>
          <ul>{problems.map((p) => <li key={p.key}>{p.message}</li>)}</ul>
        </Alert>
      )}
      <p className="tiny muted">
        <HardDrive size={13} /> {when ? tr("Last backup: {when}", { when }) : tr("No backup has been made yet")}
        {data.backup && <> · {data.backup.encrypted ? tr("encrypted") : tr("not encrypted")} · {data.offsite ? tr("a copy is kept off this server") : tr("kept on this server only")}</>}
        {data.disk_free_mb != null && <> · {tr("{n} GB of disk space free", { n: (data.disk_free_mb / 1024).toLocaleString(locale(), { maximumFractionDigits: 1 }) })}</>}
      </p>
    </section>
  );
}
