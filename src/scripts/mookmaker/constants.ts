import {WORLD_FOLDERS} from "../world-folders.js";
export {MODULE_ID} from "../settings.js";
export const SUPPORTED_SYSTEM_ID = "cyberpunk-red-core" as const;

export const FOLDER_NAMES = {
  root: WORLD_FOLDERS.root,
  templates: WORLD_FOLDERS.mookTemplates,
  promoted: WORLD_FOLDERS.mookPromoted,
} as const;

export const CREATED_BY_MOOK_MAKER_FLAG = "CreatedByMookMaker" as const;
export const PROMOTED_FROM_MOOK_MAKER_FLAG = "PromotedFromMookMaker" as const;
export const DEFAULT_MOOK_TEMPLATE_FLAG = "IsDefaultMookTemplate" as const;
export const DEFAULT_MOOK_TEMPLATE_VERSION_FLAG = "DefaultMookTemplateVersion" as const;
export const DEFAULT_MOOK_TEMPLATE_VERSION = 5 as const;
export const FOLDER_KIND_FLAG = "FolderKind" as const;
