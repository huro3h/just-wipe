# Just Wipe

閲覧履歴・ダウンロード履歴・キャッシュを削除する、シンプルな Chrome 拡張機能。

「Auto History Wipe」の多機能さを削ぎ落とし、本当に必要な機能だけに絞りました。

## 機能

- **削除するもの**（チェックで選択）
  - 閲覧履歴
  - ダウンロード履歴
  - キャッシュ（初期値は OFF。範囲の指定に関係なく、常にすべて削除）
- **削除する範囲**（直近を残して、それ以前を削除するリテンション方式）
  - すべて削除 / 直近 1 時間を残す / 直近 24 時間を残す / 直近 7 日間を残す / カスタム（残す日数を整数で指定）
- **削除の起動方法**
  - 手動（ポップアップの「削除する」ボタン）
  - ブラウザ起動時に自動削除（トグル ON/OFF）

設定はすべて `chrome.storage.sync` に保存され、自動削除もこの設定に従います。

## インストール（開発版の読み込み）

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このフォルダ（`just-wipe`）を選択

## ファイル構成

| ファイル | 役割 |
|----------|------|
| `manifest.json` | 拡張機能の定義（Manifest V3） |
| `wipe.js` | 削除ロジック（ポップアップと SW で共有） |
| `background.js` | Service Worker。起動時の自動削除＋アイコンのテーマ追従 |
| `offscreen.html` / `offscreen.js` | `prefers-color-scheme` を読む offscreen ドキュメント |
| `theme-icons.js` | テーマ別アイコンの定義と適用ヘルパー（popup / SW 共有） |
| `popup.html` / `popup.css` / `popup.js` | ポップアップ UI |
| `icons/` | アイコン。`icon.svg`（濃色）と `icon-white.svg`（淡いグレー）が元データ、`icon{16,32,48,128}.png` と `icon{…}-white.png` を使用 |

## 権限

| 権限 | 用途 |
|------|------|
| `browsingData` | 「すべて削除」時の一括削除、キャッシュの削除 |
| `history` | 直近を残す指定時の閲覧履歴削除（`history.deleteRange` で境界より前を削除） |
| `downloads` | 直近を残す指定時のダウンロード履歴削除（`downloads.erase` で境界より前を削除） |
| `storage` | 設定の保存 |
| `offscreen` | カラーテーマ判定用の offscreen ドキュメント（アイコンのテーマ追従） |

## 補足・既知の制約

- すべての範囲指定は相対的な「直近◯◯を残す」方式のため、自動削除でもそのまま機能します
  （カスタムの「残す日数」も同様。0 を指定するとすべて削除）。
- **ツールバーアイコンは Chrome の明暗モードに追従**します。Chrome には拡張から
  ブラウザUIテーマを読む API もテーマ別アイコンのマニフェスト機能も無いため、
  offscreen ドキュメントで `prefers-color-scheme`（＝Chrome 設定の「デザイン → モード」に連動）を判定し、
  `chrome.action.setIcon` で濃色（明るいツールバー用）と淡いグレー（暗いツールバー用）を切り替えます。
  - 非表示の offscreen では `change` イベントが発火しないことがあるため、
    **常駐する offscreen 内の `setInterval`（1 秒）で監視し、値が変わった時だけ SW に通知**します。
    ポーリングは常駐文書内で回るため SW を起こさず、SW が起きるのはテーマが実際に変わった時だけです（低負荷・高速）。
  - ポップアップを開いたときは、可視文書として確実に判定できるため即座にアイコンを合わせます。
- ダウンロード「履歴」の削除であり、ダウンロード済みのファイル本体は削除しません。
- キャッシュは `browsingData` API が削除の開始時刻（`since`）しか指定できず「直近を残す」ことができないため、
  範囲の指定に関係なく常にすべて削除します。

## アイコンの再生成

`icons/icon.svg`（濃色）/ `icons/icon-white.svg`（淡いグレー）を編集したら、以下で PNG を作り直せます（`rsvg-convert` 使用）:

```sh
cd icons
for s in 16 32 48 128; do
  rsvg-convert -w $s -h $s icon.svg       -o icon$s.png
  rsvg-convert -w $s -h $s icon-white.svg -o icon$s-white.png
done
```
