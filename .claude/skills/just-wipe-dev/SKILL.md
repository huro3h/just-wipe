---
name: just-wipe-dev
description: >-
  Just Wipe（閲覧履歴・ダウンロード履歴を削除する Chrome 拡張機能, Manifest V3）の開発・修正時に使う。
  拡張のファイル構成、削除ロジック、テーマ追従アイコンの仕組み、テスト（読み込み直し）手順、
  よくある落とし穴をまとめている。この拡張のコードを追加・変更・デバッグするとき、
  アイコンやテーマ追従を触るとき、権限やマニフェストを変えるときに読むこと。
---

# Just Wipe 開発ガイド

シンプルな Chrome 拡張機能（Manifest V3）。閲覧履歴とダウンロード履歴を、直近を残して
それ以前を削除する。「Auto History Wipe」から本当に必要な機能だけを抜き出したもの。

## 全体像・設計方針

- **とにかくシンプルに保つ**。機能追加の要望が来ても、まず「本当に必要か」を問う。多機能化は
  この拡張の存在意義に反する。
- コメント・UI 文言はすべて**日本語**。既存のトーンに合わせる。
- ビルドステップ・依存パッケージ・フレームワークは無し。素の JS/HTML/CSS。`npm` も `git` も使わない
  （このディレクトリは git 管理外）。

## ファイル構成と責務

| ファイル | 役割 |
|----------|------|
| `manifest.json` | 拡張の定義（MV3）。権限・アイコン・popup・service worker を宣言 |
| `wipe.js` | **削除ロジックの中核**。設定の型・取得/保存・範囲解決・削除実行。popup と SW が共有 |
| `background.js` | Service Worker。起動時の自動削除＋アイコンのテーマ追従の司令塔 |
| `offscreen.html` / `offscreen.js` | `prefers-color-scheme` を監視する常駐 offscreen ドキュメント |
| `theme-icons.js` | テーマ別アイコン定義と `setThemeIcon(dark)` ヘルパー（popup / SW 共有） |
| `popup.html` / `popup.css` / `popup.js` | ポップアップ UI とその制御 |
| `icons/` | `icon.svg`（濃色）/ `icon-white.svg`（淡いグレー）が元データ。各サイズ PNG を使用 |

依存の向き: `popup.js` と `background.js` が `wipe.js` / `theme-icons.js` を import する。
`wipe.js` と `theme-icons.js` は他に依存しない純粋なモジュール。ロジックを変えるならまず `wipe.js`。

## 削除ロジック（wipe.js）— ここが心臓部

- 設定は `DEFAULT_SETTINGS` で定義し、`chrome.storage.sync` に保存。**自動削除もこの同じ設定を参照する**
  ため、設定項目を増やすときは popup / SW 両方で辻褄を合わせること。
- 範囲指定は**すべて相対的な「直近◯◯を残す」方式**（`resolveRange` が `before` 境界を返す）。
  これは自動削除でも同じ設定でそのまま機能させるための重要な設計。絶対時刻の範囲は導入しない。
- 削除の分岐（`wipe`）:
  - `before == null`（＝「すべて削除」）→ `chrome.browsingData.remove({since:0}, …)` で一括。
  - `before` あり → `chrome.history.deleteRange` と `chrome.downloads.erase({startedBefore})` で
    境界より前を個別に削除。
- **キャッシュ（`wipeCache`、初期値 OFF）は範囲に関係なく常にすべて削除**する。`browsingData` は
  `since`（開始）しか指定できず「直近を残す」ができないため。`before` ありのときは
  `chrome.browsingData.removeCache({since:0})` を別に呼ぶ。
- カスタムの「残す日数」に `0` を指定すると `before = now`（実質すべて削除）になる。

## テーマ追従アイコン — 触る前に必読

Chrome には「拡張からブラウザ UI テーマを読む API」も「テーマ別アイコンのマニフェスト機能」も**無い**。
そのため以下の仕組みで擬似的に追従させている:

- **offscreen ドキュメント**（`offscreen.js`）が `prefers-color-scheme`（＝Chrome 設定の
  デザイン→モードに連動）を監視。非表示文書では `change` が発火しないことがあるので、
  **常駐 offscreen 内の `setInterval`（1秒）で監視し、値が変わった時だけ SW に通知**する。
  ポーリングは常駐文書内で回るので SW は起こさない（低負荷）。
- SW（`background.js`）は通知を受けて `setThemeIcon` でアイコンを差し替える。SW 再起動直後は
  `pollTheme()` で現在値を取り直す。
- popup は可視文書なので確実に判定でき、開いた瞬間に `applyToolbarIcon` で即合わせる。
- **落とし穴**: 非表示 offscreen のタイマーは約1秒にクランプされる。ポーリング間隔を1秒未満にしても無意味。
  offscreen の `reasons` は `MATCH_MEDIA`。理由文字列（justification）も MV3 では必須。

## テスト手順（自動テストは無い → 手動で読み込み直す）

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 初回は「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
4. コード変更後は、拡張カードの**再読み込み（リロード）アイコン**を押す
   - `manifest.json` を変えたときや SW の挙動を疑うときは特に確実に再読み込みする
5. 確認ポイント:
   - popup で各チェック・範囲・削除ボタンが期待通り動くか
   - 「ブラウザ起動時に自動削除」ON で Chrome 再起動時に削除されるか（`onStartup`）
   - Chrome の明暗モードを切り替えてツールバーアイコンが追従するか
   - SW のログは拡張カードの「Service Worker」リンクから DevTools で確認

## アイコンの再生成

`icons/icon.svg`（濃色）/ `icons/icon-white.svg`（淡いグレー）を編集したら PNG を作り直す
（`rsvg-convert` 使用）:

```sh
cd icons
for s in 16 32 48 128; do
  rsvg-convert -w $s -h $s icon.svg       -o icon$s.png
  rsvg-convert -w $s -h $s icon-white.svg -o icon$s-white.png
done
```

## よくある落とし穴・注意

- **権限を増やしたら** `manifest.json` の `permissions` と `README.md` の権限表の両方を更新する。
- ダウンロードは「履歴」の削除であって、**ダウンロード済みファイル本体は消さない**（`downloads.erase` の仕様）。
- 設定項目を追加するときは `DEFAULT_SETTINGS`・`readUI`/`init`（popup.js）・`popup.html` の3点を揃える。
- ES module 構成（manifest の `"type": "module"`, popup は `<script type="module">`）。import パスに注意。
- README のファイル構成表・権限表は仕様変更時に更新する（ドキュメントと実装を乖離させない）。
