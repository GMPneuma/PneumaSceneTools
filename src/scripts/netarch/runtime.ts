/** Dynamic Cyberpunk RED and canvas integration boundary. Native objects remain unchanged.
 * Lookups stay live because Foundry installs the canvas and test worlds after module import.
 */
function nativeGlobal(name: string): any {
  switch (name) {
    case "game": return game;
    case "canvas": return canvas;
    case "ui": return ui;
    case "Hooks": return Hooks;
    case "Actor": return Actor;
    case "Folder": return Folder;
    case "CONST": return CONST;
    case "foundry": return foundry;
    default: return (globalThis as any)[name];
  }
}
function liveGlobal(name: string, bindMethods = true): any {
  return new Proxy({}, {get: (_target, key) => {
    const native = nativeGlobal(name), value = native?.[key];
    return bindMethods && typeof value === "function" ? value.bind(native) : value;
  }});
}
const gameBoundary = liveGlobal("game"), canvasBoundary = liveGlobal("canvas"), uiBoundary = liveGlobal("ui"), hooksBoundary = liveGlobal("Hooks");
const foundryBoundary = liveGlobal("foundry"), pixiBoundary = liveGlobal("PIXI", false), constBoundary = liveGlobal("CONST");
const actorBoundary = liveGlobal("Actor"), folderBoundary = liveGlobal("Folder"), wrapperBoundary = liveGlobal("libWrapper");
export {gameBoundary as game, canvasBoundary as canvas, uiBoundary as ui, hooksBoundary as Hooks,
  foundryBoundary as foundry, pixiBoundary as PIXI, constBoundary as CONST,
  actorBoundary as Actor, folderBoundary as Folder, wrapperBoundary as libWrapper};
function nativeConstructor(name: string): any {
  // Foundry's classic scripts expose these classes as lexical globals, not window properties.
  switch (name) {
    case "Application": return Application;
    case "FormApplication": return FormApplication;
    case "FilePicker": return FilePicker;
    case "Token": return Token;
    default: throw new Error(`Unknown Foundry constructor: ${name}`);
  }
}
function liveConstructor(name: string): any {
  return new Proxy(function () {}, {
    construct: (_target, args, newTarget) => Reflect.construct(nativeConstructor(name), args, newTarget),
    get: (_target, key) => nativeConstructor(name)?.[key],
  });
}
const applicationBoundary = liveConstructor("Application"), formApplicationBoundary = liveConstructor("FormApplication");
const filePickerBoundary = liveConstructor("FilePicker"), tokenBoundary = liveConstructor("Token");
export {applicationBoundary as Application, formApplicationBoundary as FormApplication,
  filePickerBoundary as FilePicker, tokenBoundary as Token};
const loadTextureBoundary = (...args: any[]): any => (loadTexture as any)(...args);
const fromUuidBoundary = (...args: any[]): any => (fromUuid as any)(...args);
export {loadTextureBoundary as loadTexture, fromUuidBoundary as fromUuid};

