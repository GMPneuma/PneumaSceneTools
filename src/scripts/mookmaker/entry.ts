import {registerFeature} from "../lifecycle.js";
import {registerMookMaker, readyMookMaker} from "./main.js";
registerFeature({name:"MookMaker",register:registerMookMaker,ready:readyMookMaker});
