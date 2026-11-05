// Just Wipe — shared logic for the popup and the service worker.

export const DEFAULT_SETTINGS = {
  wipeHistory: true, // 閲覧履歴を削除する
  wipeDownloads: true, // ダウンロード履歴を削除する
  wipeCache: false, // キャッシュを削除する（範囲に関係なくすべて）
  period: "all", // "all" | "hour" | "day" | "week" | "custom"
  customKeepDays: 30, // カスタム: 直近この日数を残し、それ以前を削除
  autoOnStartup: false, // ブラウザ起動時に自動削除
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch) {
  await chrome.storage.sync.set(patch);
}

// 設定から「この時刻より前を削除する」境界(before)を解決する。
// 直近の一定期間は残し、それより前を削除するリテンション方式。
// before が null のときは「すべて削除」（境界なし）を意味する。
export function resolveRange(settings, now) {
  switch (settings.period) {
    case "hour":
      return { before: now - HOUR }; // 直近1時間を残す
    case "day":
      return { before: now - DAY }; // 直近24時間を残す
    case "week":
      return { before: now - 7 * DAY }; // 直近7日間を残す
    case "custom": {
      const days = Number(settings.customKeepDays);
      const keep = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
      return { before: now - keep * DAY }; // 直近 keep 日を残す
    }
    case "all":
    default:
      return { before: null }; // すべて削除
  }
}

// 実際の削除を行う。削除対象・範囲は settings に従う。
// 「before」より前の履歴を削除する（before が null ならすべて削除）。
// キャッシュは上限（before）を指定できないため、範囲に関係なくすべて削除する。
// 返り値: { history: bool, downloads: bool, cache: bool, before }
export async function wipe(settings, now) {
  const { before } = resolveRange(settings, now);
  const doHistory = !!settings.wipeHistory;
  const doDownloads = !!settings.wipeDownloads;
  const doCache = !!settings.wipeCache;

  if (!doHistory && !doDownloads && !doCache) {
    return { history: false, downloads: false, cache: false, before };
  }

  if (before == null) {
    // すべて削除。browsingData で一括削除するのが最も確実。
    await chrome.browsingData.remove(
      { since: 0 },
      { history: doHistory, downloads: doDownloads, cache: doCache }
    );
  } else {
    // 「before より前」を削除。上限を指定できる個別 API を使う。
    if (doHistory) {
      await chrome.history.deleteRange({ startTime: 0, endTime: before });
    }
    if (doDownloads) {
      await chrome.downloads.erase({
        startedBefore: new Date(before).toISOString(),
      });
    }
    if (doCache) {
      // browsingData は開始時刻（since）しか指定できないので、すべて削除する。
      await chrome.browsingData.removeCache({ since: 0 });
    }
  }

  return { history: doHistory, downloads: doDownloads, cache: doCache, before };
}
