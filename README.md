# Maken Shao Complete Guide

《Maken Shao（魔剣爻）》的可驗證、可維護繁體中文知識庫網站。v0.1 是網站與資料規範骨架；**不包含正式攻略內容**。

## 原則

- 不猜測、不把未查證內容寫成事實。
- Dreamcast《Maken X》與 PS2《Maken Shao》以 `gameVersion` 明確區隔。
- 正式資料必須有來源、可信度、查證狀態與最後查證日。
- 範例必須標示「示範資料，非正式攻略內容」。

## 開啟網站

不需要安裝套件。直接開啟 `index.html` 可閱讀靜態骨架；但大多數瀏覽器會禁止 `file://` 對 JSON 的 `fetch`，搜尋與資料載入請以本機靜態伺服器開啟：

```bash
cd /opt/data/workspace/maken-shao
python3 -m http.server 8000
```

瀏覽 `http://localhost:8000/`。本專案沒有外部 CDN、後端或資料庫。

## 結構

- `assets/`：本機 CSS 與 Vanilla JavaScript。
- `data/`：網站 metadata、來源與內容資料陣列。
- `schemas/`：Draft 2020-12 JSON Schema，每種資料類型一份。
- `pages/`：網站頁面。
- `docs/`：架構、資料模型、來源與驗證流程文件。
- `scripts/`：無第三方依賴的資料與連結檢查器。
- `tests/`：Node 原生測試。

## 驗證

需要 Node.js 22 或相容的現代 Node.js，且無需 `npm install`：

```bash
npm test
npm run validate:data
npm run check:links
npm run check:js
```

## 新增資料

1. 先在 `sources.json` 建立來源，依 `schemas/source.schema.json` 填寫，取得唯一小寫 kebab-case `id`。
2. 在對應資料檔加入資料物件，所有 required 欄位都不可省略或為 `null`。
3. 僅使用 `maken-x-dreamcast`、`maken-shao-ps2`、`both-confirmed` 作為 `gameVersion`。
4. 填入存在的 `sourceIds`；在 `verificationNote` 寫頁碼、章節、時間戳或其他可追溯定位資訊。
5. 選擇受控的 `confidence` 與 `verificationStatus`，並填入真實 ISO 日期 `YYYY-MM-DD`。
6. 未查證的示例只能使用 `isPlaceholder: true`，並在文字中寫入「示範資料，非正式攻略內容」。
7. 執行全部驗證命令；通過後才能送交人工來源審查。

詳細規則見 `docs/source-policy.md` 與 `docs/verification-workflow.md`。
