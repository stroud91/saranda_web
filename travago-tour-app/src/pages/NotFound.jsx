import { Link } from "react-router-dom";
import SceneArt from "../components/art/SceneArt";
import { tr } from "../i18n";

export default function NotFound() {
  return (
    <div className="page container narrow center">
      <div className="notfound-art"><SceneArt scene="cove" seed="lost" variant="dusk" /></div>
      <h1>{tr("Lost at sea?")}</h1>
      <p className="muted">{tr("This page drifted off. Let's get you back to shore.")}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link to="/" className="btn primary">{tr("Home")}</Link>
        <Link to="/map" className="btn">{tr("Open the map")}</Link>
      </div>
    </div>
  );
}
