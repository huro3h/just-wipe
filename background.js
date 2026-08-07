// Just Wipe — service worker.
// ・ブラウザ起動時の自動削除
// ・ツールバーアイコンを Chrome の明暗モードに追従させる
import { getSettings, wipe } from "./wipe.js";
import { setThemeIcon } from "./theme-icons.js";

// テーマ監視用の offscreen ドキュメントが無ければ作成する
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["MATCH_MEDIA"],
    justification:
      "ツールバーアイコンをカラーテーマに追従させるため prefers-color-scheme を監視する",
  });
}

// 起動直後の初期化用に、現在のテーマを offscreen へ問い合わせて反映する。
// （生成直後は offscreen 側の初期通知でも反映されるため、これは主に SW 再起動時の取り直し用）
async function pollTheme() {
  await ensureOffscreen();
  try {
    const res = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "poll",
    });
    if (res && typeof res.dark === "boolean") await setThemeIcon(res.dark);
  } catch (_) {
    // offscreen 準備中などは、offscreen 側の初期通知で反映される
  }
}

// offscreen からの通知（テーマ変化時のみ届く）でアイコンを更新
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.from === "offscreen" && typeof msg.dark === "boolean") {
    setThemeIcon(msg.dark);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  pollTheme();
});

chrome.runtime.onStartup.addListener(async () => {
  await pollTheme();
  const settings = await getSettings();
  if (settings.autoOnStartup) {
    await wipe(settings, Date.now());
  }
});
