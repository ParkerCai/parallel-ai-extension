export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

export const PRIMARY_MODIFIER_LABEL = IS_MAC ? "Cmd" : "Ctrl";
export const META_KEY_LABEL = IS_MAC ? "Cmd" : "Win";
export const ALT_KEY_LABEL = IS_MAC ? "Option" : "Alt";
