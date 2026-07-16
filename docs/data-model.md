# 資料模型

所有內容檔頂層是 JSON 陣列；每一筆使用唯一、小寫 kebab-case `id`。`site.json` 是單一網站 metadata 物件。

## 共通內容欄位

| 欄位 | 規則 |
| --- | --- |
| `id` | 必填、唯一、2–80 字元 kebab-case。 |
| `title` / `summary` / `content` | 必填文字；不得把未查證推測陳述為事實。 |
| `gameVersion` | `maken-x-dreamcast`、`maken-shao-ps2`、`both-confirmed` 其中之一。 |
| `region` | `unknown` 或兩碼大寫 ISO 3166-1 code。 |
| `sourceIds` | 至少一個、且每一項必須存在於 `sources.json`。 |
| `confidence` | `official`、`cross-verified`、`single-source`、`unverified`。 |
| `verificationStatus` | `verified`、`partially-verified`、`conflicting`、`not-verified`。 |
| `verificationNote` | 必填；記錄頁碼、章節、衝突或待查說明。 |
| `lastVerified` | 必填真實日期 `YYYY-MM-DD`。 |
| `isPlaceholder` / `spoiler` | 可為 boolean 或 `null`；placeholder 必含固定警語。 |

## 型別特有欄位

- `characters.json`：`role`
- `walkthrough.json`：`sequence`、`area`
- `knowledge.json`：`category`
- `endings.json`：`endingType`
- `bosses.json`：`location`

這些欄位在 v0.1 都是 required-but-nullable，目的是固定未來資料介面而不強迫未研究內容。來源資料則使用 `source.schema.json`，含來源類型、層級、作者／出版者、URL、日期及註記。

## 關聯與完整性

內容項目的 `sourceIds` → `sources.json[].id`。驗證器拒絕不存在的來源、重複 ID、無效 enum 和假日期；`verified + unverified` 以及缺少衝突說明亦會被拒絕。
