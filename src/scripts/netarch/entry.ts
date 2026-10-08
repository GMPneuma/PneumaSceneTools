import {registerFeature} from "../lifecycle.js";
import {registerNetArchScanner, readyNetArchScanner, netArchScannerApi} from "./main.js";
registerFeature({
  name:"NetArch Scanner",
  register() { registerNetArchScanner(); return {netArchScanner:netArchScannerApi()}; },
  ready:readyNetArchScanner,
});
