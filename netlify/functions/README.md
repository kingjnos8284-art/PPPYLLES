# 後端函式（預留）

日後加入帳號、雲端存檔、好友系統時，API 放在這個資料夾。
網址會是 `/api/<檔名>`（`netlify.toml` 已設定轉址）。

建議的端點：

| 端點 | 用途 |
|---|---|
| `GET /api/time` | 回傳伺服器時間，用於離線收益計算（防止改手機時間） |
| `GET /api/save` / `PUT /api/save` | 讀取／寫入雲端存檔 |
| `GET /api/friends` | 好友清單 |
| `POST /api/friends` | 以好友代碼加好友 |
| `GET /api/tank/:userId` | 參觀好友水族箱（唯讀） |

前端對應的介面在 `public/js/services/types.js`，
實作 `public/js/services/remote.js` 後切換 `services/index.js` 的 `BACKEND_MODE` 即可。
