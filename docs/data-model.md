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

- `world.json`：`worldCategory`（v0.2 世界觀、版本脈絡與術語）
- `systems.json`：`systemArea`（v0.2 系統資料與研究中機制）
- `characters.json`：`nameZhHant`、`nameJa`、`nameEn`、`nameEnStatus`、`imagePath`、`imageAlt`、`imageKind`、`imageSourceId`、`imageOriginalUrl`、`imageSha256`、`role`、`characterType`、`affiliations`、`brainJackStatus`、`firstAppearanceWalkthroughId`、`relatedWalkthroughIds`、`spoilerLevel`
  - `firstAppearanceWalkthroughId` 若非 `null`，必須同時存在於 `relatedWalkthroughIds`，且所有流程 ID 必須存在。
  - `walkthrough.json[].brainJackTargetIds` 只能引用 `brainJackStatus: confirmed-host` 的已建立角色 ID；每個 confirmed host 也必須至少被一個流程節點反向引用。空陣列表示尚未建檔或尚未查證，不代表不存在。
  - `spoilerLevel: major` 的角色由前端整張預設收合。
  - `imageKind: official-source` 必須同時提供已登錄的 `imageSourceId`、精確 `imageOriginalUrl` 與本地檔 `imageSha256`；`no-attributable-source` 使用明確標示的站內佔位圖，來源欄保持 `null`。
- `walkthrough.json`：`sequence`、`area`、`routeId`、`routeTitle`、`objectives`、`prerequisites`、`anyOfPrerequisites`、`branchChoiceIds`、`bossIds`、`brainJackTargetIds`、`missable`、`spoilerLevel`
  - `sequence` 是流程圖的顯示拓撲順序；驗證器拒絕指向更早順序的分支。
  - `prerequisites` 表示必須全部成立的前置節點；`anyOfPrerequisites` 表示任一節點成立即可，用於匯合或多入口區域。
  - 每個 `branchChoiceIds` 目標必須反向宣告來源為必要或任一前置，並接受未知 ID、重複引用、自我引用與前置循環檢查。
  - `bossIds`／`brainJackTargetIds` 可為空，表示對應正式資料尚未建立，而不是「遊戲中不存在」。
  - `spoilerLevel` 限定 `none`、`minor`、`major`；重大劇透的標題、摘要、區域、條件與正文由前端整體預設收合。
- `knowledge.json`：`category`
- `endings.json`：`endingType`
- `bosses.json`：`location`

這些欄位在 v0.1 都是 required-but-nullable，目的是固定未來資料介面而不強迫未研究內容。來源資料則使用 `source.schema.json`，含來源類型、層級、作者／出版者、URL、日期及註記。

## 關聯與完整性

內容項目的 `sourceIds` → `sources.json[].id`。驗證器拒絕不存在的來源、重複 ID、無效 enum 和假日期；`verified + unverified` 以及缺少衝突說明亦會被拒絕。
