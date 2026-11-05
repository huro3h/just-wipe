// Just Wipe — popup UI logic.
import { getSettings, saveSettings, wipe } from "./wipe.js";
import { setThemeIcon } from "./theme-icons.js";

// ポップアップは可視のためテーマ判定が確実。開いた瞬間にアイコンを合わせ、
// 表示中のテーマ変更にも追従する。
const themeMq = matchMedia("(prefers-color-scheme: dark)");
const applyToolbarIcon = () => setThemeIcon(themeMq.matches);
themeMq.addEventListener("change", applyToolbarIcon);
applyToolbarIcon();

const els = {
  wipeHistory: document.getElementById("wipeHistory"),
  wipeDownloads: document.getElementById("wipeDownloads"),
  wipeCache: document.getElementById("wipeCache"),
  period: document.getElementById("period"),
  customRange: document.getElementById("customRange"),
  customKeepDays: document.getElementById("customKeepDays"),
  wipeBtn: document.getElementById("wipeBtn"),
  status: document.getElementById("status"),
  autoOnStartup: document.getElementById("autoOnStartup"),
};

// 「残す日数」入力を 0 以上の整数に正規化する（不正なら null）
function parseKeepDays(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toggleCustom() {
  els.customRange.classList.toggle("hidden", els.period.value !== "custom");
}

function updateWipeButton() {
  const nothingSelected =
    !els.wipeHistory.checked &&
    !els.wipeDownloads.checked &&
    !els.wipeCache.checked;
  els.wipeBtn.disabled = nothingSelected;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

// 現在の UI 状態を設定オブジェクトに変換
function readUI() {
  return {
    wipeHistory: els.wipeHistory.checked,
    wipeDownloads: els.wipeDownloads.checked,
    wipeCache: els.wipeCache.checked,
    period: els.period.value,
    customKeepDays: parseKeepDays(els.customKeepDays.value),
    autoOnStartup: els.autoOnStartup.checked,
  };
}

async function persist() {
  await saveSettings(readUI());
}

async function init() {
  const s = await getSettings();
  els.wipeHistory.checked = s.wipeHistory;
  els.wipeDownloads.checked = s.wipeDownloads;
  els.wipeCache.checked = s.wipeCache;
  els.period.value = s.period;
  els.autoOnStartup.checked = s.autoOnStartup;

  // カスタムの初期値（残す日数）
  els.customKeepDays.value = s.customKeepDays ?? 30;

  toggleCustom();
  updateWipeButton();

  // 設定はすべて変更時に即保存（自動削除もこの値を参照する）
  [
    els.wipeHistory,
    els.wipeDownloads,
    els.wipeCache,
    els.period,
    els.customKeepDays,
    els.autoOnStartup,
  ].forEach((el) => {
    el.addEventListener("change", () => {
      toggleCustom();
      updateWipeButton();
      persist();
    });
  });

  els.wipeBtn.addEventListener("click", onWipe);
}

async function onWipe() {
  els.wipeBtn.disabled = true;
  setStatus("削除中…");
  try {
    await persist();
    const result = await wipe(readUI(), Date.now());
    const parts = [];
    if (result.history) parts.push("閲覧履歴");
    if (result.downloads) parts.push("ダウンロード履歴");
    if (result.cache) parts.push("キャッシュ");
    setStatus(`✓ ${parts.join("・")}を削除しました`);
  } catch (e) {
    setStatus(`エラー: ${e?.message ?? e}`, true);
  } finally {
    updateWipeButton();
  }
}

init();
