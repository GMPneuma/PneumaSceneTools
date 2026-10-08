export interface Audience { public: boolean; users: string[]; }
export interface Discovery extends Audience { revealed: boolean; runners: string[]; runnerUsers?: Record<string, string[]>; }
export interface Pulse { id: string; started: number; duration: number; count: number; loop: boolean; audience: Audience; }
export interface APData { version: number; accessPoint: boolean; type: string; netarch: string; discovery: Discovery; pulse: Pulse | null; showName: boolean; }
export interface APType { id: string; label: string; img: string; enabled: boolean; }
export interface ArchitectureColor { uuid: string; color: string; }
export interface APChanges { reveal?: "runner" | "all" | "hidden" | "removeRunner"; pulse?: "five" | "loop" | "off"; showName?: boolean; }
export interface APDetails { name: string; type: string; netarch: string; color: string; }
export interface ScannerOptions { scene?: Scene | null; runnerId?: string; result?: number | null; selected?: string[]; messageId?: string | null; }
export interface ScannerRoll { ability?: string; entityData?: {actor?: string; token?: string}; resultTotal?: number; }
export interface ScanContext { actorId: string; tokenId: string | null; sceneId: string | null; total: number; }
export interface ScannerChatClass { RenderRollCard(roll: ScannerRoll, ...args: unknown[]): Promise<ChatMessage | undefined>; }
export interface ScannerSettings {
  apTypes: {entries?: APType[]}; revealStyle: string; visionRadius: number; scannerRadius: number;
  hideRevealAll: boolean; showRevealAll: boolean; autoPulse: boolean; pulseCount: number;
  pulseDuration: number; showLabels: boolean; autoScanner: boolean; netarchColors: {entries: ArchitectureColor[]};
}
declare global {
  interface SettingConfig {
    "pneuma-scenetools.apTypes": ScannerSettings["apTypes"];
    "pneuma-scenetools.revealStyle": string;
    "pneuma-scenetools.visionRadius": number;
    "pneuma-scenetools.scannerRadius": number;
    "pneuma-scenetools.hideRevealAll": boolean;
    "pneuma-scenetools.showRevealAll": boolean;
    "pneuma-scenetools.autoPulse": boolean;
    "pneuma-scenetools.pulseCount": number;
    "pneuma-scenetools.pulseDuration": number;
    "pneuma-scenetools.showLabels": boolean;
    "pneuma-scenetools.autoScanner": boolean;
    "pneuma-scenetools.netarchColors": ScannerSettings["netarchColors"];
  }
  interface FlagConfig {
    Token: {"pneuma-scenetools": Partial<APData>};
    Actor: {"pneuma-scenetools": {templateType?: string}};
    Scene: {"pneuma-scenetools": {unassignedColor?: string}};
    ChatMessage: {"pneuma-scenetools": {scan?: ScanContext}};
  }
  var libWrapper: {register(module: string, target: string, callback: Function, kind: "WRAPPER" | "MIXED"): void};
  var pneumaSceneToolsNetArchCompat: {chatClass: ScannerChatClass} | undefined;
}
