/** Dynamic Cyberpunk RED and canvas integration boundary. Native objects remain unchanged.
 * Lookups stay live because Foundry installs the canvas and test worlds after module import.
 */
function liveGlobal(name: string, bindMethods = true): any {
  return new Proxy({}, {get: (_target, key) => {
    const value = (globalThis as unknown as Record<string, any>)[name]?.[key];
    return bindMethods && typeof value === "function" ? value.bind((globalThis as unknown as Record<string, any>)[name]) : value;
  }});
}
export const game = liveGlobal("game"), canvas = liveGlobal("canvas"), ui = liveGlobal("ui"), Hooks = liveGlobal("Hooks");
export const foundry = liveGlobal("foundry"), PIXI = liveGlobal("PIXI", false), CONST = liveGlobal("CONST");
export const Actor = liveGlobal("Actor"), Folder = liveGlobal("Folder"), libWrapper = liveGlobal("libWrapper");
function liveConstructor(name: string): any {
  return new Proxy(function () {}, {
    construct: (_target, args, newTarget) => Reflect.construct((globalThis as any)[name], args, newTarget),
    get: (_target, key) => (globalThis as any)[name]?.[key],
  });
}
export const Application = liveConstructor("Application"), FormApplication = liveConstructor("FormApplication");
export const FilePicker = liveConstructor("FilePicker"), Token = liveConstructor("Token");
export const loadTexture = (...args: any[]): any => (globalThis as any).loadTexture(...args);
export const fromUuid = (...args: any[]): any => (globalThis as any).fromUuid(...args);

