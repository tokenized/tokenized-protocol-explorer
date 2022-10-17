import { HTML, route } from "ui-io";
import { location$ } from "./location.js";
import { addr } from "./pages/addr.js";
import id from "./pages/id.js";
import home from "./pages/home.js";
import tx from "./pages/tx.js";

const { div } = HTML(document);

document.body.append(div(route(location$, { id, addr, tx }, home)));