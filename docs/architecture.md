# 網站架構

## 分層

| 層 | 路徑 | 責任 |
| --- | --- | --- |
| 展示 | `index.html`、`pages/*.html` | 語意化內容結構、導覽、搜尋介面、劇透控制入口。 |
| 樣式 | `assets/css/style.css` | 本機深／淺色主題、側欄、手機選單、響應式版面與可見焦點。 |
| 前端行為 | `assets/js/app.js` | 主題儲存、選單、搜尋、劇透收合與返回頂端。 |
| 資料載入 | `assets/js/data-loader.js` | 對本機 JSON 進行 `fetch()`；失敗時顯示離線開啟提示。 |
| 前端輕量檢核 | `assets/js/validator.js` | 提供可重用的基本資料欄位檢查；正式 gate 仍以 Node script 為準。 |
| 資料契約 | `schemas/*.schema.json` | Draft 2020-12 的欄位、enum、nullable、格式與額外欄位限制。 |
| CI／本機 gate | `scripts/*.js` | 驗證資料、內部連結與基本 HTML 結構。 |

## 資料流

`data/*.json` → `data-loader.js` → `app.js` 搜尋結果。資料寫入前先由 `validate-data.js` 讀取 schema 和 `sources.json` 驗證。網站不會向外傳送查詢或資料。

## 離線限制

資產全在 repository 內，沒有 CDN。HTML 可直接離線閱讀；然而安全模型通常禁止 `file://` 讀 JSON。v0.1 對這個限制明確提示，建議用 `python3 -m http.server` 提供本機檔案。未加入 Service Worker，避免快取更新行為在未審核前變得不可預測。
