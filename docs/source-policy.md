# 來源政策與引用規則

## 優先順序

1. 官方攻略
2. 官方設定集
3. 官方網站
4. 開發者訪談
5. GameFAQs
6. Megami Tensei Wiki（僅可作為待交叉驗證資料）
7. 玩家論壇（僅佐證）

## 寫入規則

- 每個正式內容項目至少列一個有效 `sourceId`；不允許「來源不詳」。
- `verificationNote` 必須指出可定位的位置：書籍頁碼、章節標題、訪談時間戳、存檔網址 fragment 或等價資訊。
- `official` 是來源層級／證據品質描述，不保證敘述已被完整比對；仍應選擇適當 `verificationStatus`。
- 兩個版本都成立時才可填 `both-confirmed`，而且備註必須說明兩個版本各自的證據。
- 有衝突時填 `conflicting`，逐一列出衝突來源；不得選擇性隱瞞。
- 尚未有可靠證據時填 `not-verified` / `unverified`，明說「目前查無可靠來源」，不要補寫推測。
- 角色 ID 只能在角色資料本身完成來源審查後建立；不得從流程散文中的人名自動 slugify 或建立無對應條目的假 ID。
- `walkthrough.json[].brainJackTargetIds` 只能連至已建檔且標為 `confirmed-host` 的角色；取得／強制使用關係必須有 PS2 來源，並按劇透政策隱藏。

## 版權與引用

只保存必要 metadata 與短摘要。未確認權利時，不鏡像攻略全文、設定集掃描或受版權保護圖片。引用 URL 可能失效時，保留出版者、標題與日期等書目資訊以利後續追查。
