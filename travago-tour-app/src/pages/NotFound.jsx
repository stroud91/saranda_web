import { Link } from "react-router-dom";
import SceneArt from "../components/art/SceneArt";

export default function NotFound() {
  return (
    <div className="page container narrow center">
      <div className="notfound-art"><SceneArt scene="cove" seed="lost" variant="dusk" /></div>
      <h1>Lost at sea?</h1>
      <p className="muted">This page drifted off. Let's get you back to shore.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link to="/" className="btn primary">Home</Link>
        <Link to="/map" className="btn">Open the map</Link>
      </div>
    </div>
  );
}
