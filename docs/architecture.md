# 網站架構

## 分層

| 層 | 路徑 | 責任 |
| --- | --- | --- |
| 展示 | `index.html`、`pages/*.html` | 語意化內容結構、導覽、搜尋介面、角色分類 tabs 與標籤控制。 |
| 樣式 | `assets/css/style.css` | 本機深／淺色主題、側欄、手機選單、響應式版面與可見焦點。 |
| 前端行為 | `assets/js/app.js` | 主題儲存、選單、完整內容渲染、角色 tabs／多標籤查詢與返回頂端。 |
| 資料載入 | `assets/js/data-loader.js` | 對本機 JSON 進行 `fetch()`；失敗時顯示離線開啟提示。 |
| 前端輕量檢核 | `assets/js/validator.js` | 提供可重用的基本資料欄位檢查；正式 gate 仍以 Node script 為準。 |
| 資料契約 | `schemas/*.schema.json` | Draft 2020-12 的欄位、enum、nullable、格式與額外欄位限制。 |
| CI／本機 gate | `scripts/*.js` | 驗證資料、內部連結與基本 HTML 結構。 |

## 資料流

`data/*.json` → `data-loader.js` → `app.js` 搜尋結果。資料寫入前先由 `validate-data.js` 讀取 schema 和 `sources.json` 驗證。網站不會向外傳送查詢或資料。

## 卡片呈現規約（2026-07-18 產品決策）

- 所有卡片的屬性、標籤與來源均使用單行水平捲動列；順序固定為屬性、標籤、來源，來源位於卡片最下方，窄螢幕不換行。
- 角色圖鑑卡片僅保留標題、縮圖與角色介紹，不重複顯示中／日／英文名欄位、角色頁交叉參考或查證註記。
- 角色詳細頁的縮圖總覽卡，在三語姓名後呈現角色 profile；profile 以各角色的 MegaTen Wiki／Fandom 頁 `Profile`／`Personality` 段落為社群來源，且須保留 PS2《Maken Shao》與其他版本混合資料的界線；「需要此角色作為前置的角色」僅在確有相依角色時才建立卡片。
- 劇情、角色、流程、來源與結局內容不設劇透開關或收合狀態，載入時一律直接完整呈現。
- `verificationNote` 與名稱來源狀態繼續保留在資料模型與驗證流程中，但不作為前台卡片文字顯示。

## 離線限制

資產全在 repository 內，沒有 CDN。HTML 可直接離線閱讀；然而安全模型通常禁止 `file://` 讀 JSON。v0.1 對這個限制明確提示，建議用 `python3 -m http.server` 提供本機檔案。未加入 Service Worker，避免快取更新行為在未審核前變得不可預測。
