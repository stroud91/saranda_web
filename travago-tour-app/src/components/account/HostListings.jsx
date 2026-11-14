import { useEffect, useState } from "react";
import { fresh } from "../../lib/partners";
import { HOST_KINDS } from "../../lib/hostListings";
import { Alert, Skeleton } from "../ui";
import ListingManager from "../business/ListingManager";
import { tr } from "../../i18n";

/** Host desk: the site's own apartments, rentals, activities and guides. */
export default function HostListings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { fresh("/admin/listings/").then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Skeleton h={300} r={20} />;
  const put = (kind, row) => setData((d) => ({ ...d, [kind]: d[kind].some((r) => r.id === row.id) ? d[kind].map((r) => (r.id === row.id ? row : r)) : [...d[kind], row] }));
  const drop = (kind, id) => setData((d) => ({ ...d, [kind]: d[kind].filter((r) => r.id !== id) }));
  return (
    <div className="stack" style={{ "--gap": "26px" }}>
      <p className="small muted" style={{ margin: 0 }}>{tr("Everything here is your own and shows on the site as soon as you save. Listings from partner businesses are under Partners.")}</p>
      <ListingManager listings={data} options={data.options} kinds={HOST_KINDS} base="/admin/listings" host onPut={put} onDrop={drop} />
    </div>
  );
}
