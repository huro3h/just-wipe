// Just Wipe — offscreen ドキュメント。
// Service Worker では matchMedia が使えないため、常駐するこの文書で
// prefers-color-scheme（＝Chrome の明暗モード）を監視する。
// 常駐文書内で監視するので SW を起こさずに済み、
// 実際にテーマが変わった時だけ SW へ通知する（＝低負荷で高速）。

const mq = matchMedia("(prefers-color-scheme: dark)");
let last = null;

// 値が変わった時だけ SW に通知する
function checkAndPush() {
  const dark = mq.matches;
  if (dark !== last) {
    last = dark;
    chrome.runtime.sendMessage({ from: "offscreen", dark }).catch(() => {});
  }
}

// change イベント（発火する環境では即時）＋ 保険のポーリング。
// ポーリングは常駐文書内で回るため SW は起こさない。
// （非表示文書のタイマーは約1秒にクランプされるため、これより短くしても無意味）
mq.addEventListener("change", checkAndPush);
setInterval(checkAndPush, 1000);

// SW 起動直後などの現在値要求には即応答する
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.target === "offscreen" && msg.type === "poll") {
    sendResponse({ dark: mq.matches });
  }
});

// 読み込み時に初期状態を通知（last=null なので必ず送られる）
checkAndPush();
