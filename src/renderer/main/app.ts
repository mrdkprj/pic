import "./main.css";
import "../../common.css";
import "../../menu.css"
import Viewer from "./Viewer.svelte";

const app = new Viewer({
  target: document.body,
})

export default app