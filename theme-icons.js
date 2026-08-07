// Just Wipe — ツールバーアイコンのテーマ別セットと適用ヘルパー。
// popup と service worker の両方から使う。

// 明るいツールバー用（濃色アイコン）
const ICON_FOR_LIGHT = {
  16: "icons/icon16.png",
  32: "icons/icon32.png",
  48: "icons/icon48.png",
  128: "icons/icon128.png",
};
// 暗いツールバー用（白アイコン）
const ICON_FOR_DARK = {
  16: "icons/icon16-white.png",
  32: "icons/icon32-white.png",
  48: "icons/icon48-white.png",
  128: "icons/icon128-white.png",
};

export function setThemeIcon(dark) {
  return chrome.action.setIcon({ path: dark ? ICON_FOR_DARK : ICON_FOR_LIGHT });
}
