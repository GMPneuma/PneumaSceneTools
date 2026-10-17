import {MODULE_ID} from "../settings.js";
import type {TrapConfig} from "./model.js";
export interface Activation {
  region: string;
  target: string;
  event: string;
  kind: "trap";
  state: "pending" | "ready" | "applying" | "done" | "skipped" | "review";
  index: number;
  config: TrapConfig;
  chain: string[];
  error: string;
  batch: string;
  targetName: string;
  rolled: number | null;
  revision: number;
  effectCard?: {
    index: number;
    id: string;
  };
  attackReceipt?: {
    state: "starting" | "started" | "spent" | "review";
    messageId?: string;
  };
}
export function activation(message: ChatMessage): Activation | undefined {
  const value = foundry.utils.getProperty(message, `flags.${MODULE_ID}.trapActivation`) as Activation | undefined;
  return value?.kind === "trap" ? value : undefined;
}
export type ActivationAction = "disengage" | "skip" | "omit" | "roll" | "approve" | "apply";
export function isActivationAction(value: string): value is ActivationAction {
  return ["disengage", "skip", "omit", "roll", "approve", "apply"].includes(value);
}
export function advanceEffect(a: Activation): void {
  a.index++;
  a.rolled = null;
  a.state = a.index >= a.config.actions.length ? "done" : "ready";
}
export function markForReview(a: Activation, error: unknown): void {
  a.state = "review";
  a.error = String(error);
}
