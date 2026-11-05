# PPPYLLES 架構說明

## 技術

- **純前端靜態網站**：原生 JavaScript 模組（ES Modules）+ Canvas 2D，**沒有任何外部套件、不需要建置**
- 型別檢查：程式使用 JSDoc 標註型別，`npm run typecheck`（TypeScript）檢查
- 部署：Netlify，發佈資料夾為 `public/`
- PWA：手機「加入主畫面」後以全螢幕開啟

## 資料夾

```
public/
  index.html               進入點
  css/style.css            介面樣式（滿版、安全區域、手機／桌機版面）
  assets/                  美術素材與 manifest.json（規格見 docs/ASSET_SPEC.md）
  js/
    main.js                啟動、主迴圈、輸入、存檔時機
    config/                ★ 遊戲規則與數值（調整平衡改這裡）
      balance.js             起始資源、水族箱容量、離線上限、成長階段
      species.js             魚種
      landpets.js            陸地寵物
      decor.js               裝飾（預留）
    core/                  規則邏輯（不碰畫面）
      state.js               存檔結構、版本升級
      sim.js                 收益、成長、壽命、購買、互動、離線結算
    services/              ★ 後端窗口
      types.js               介面定義：帳號／存檔／好友／時間
      local.js               目前使用：瀏覽器本機存檔
      remote.js              預留：線上伺服器
      index.js               切換 local / remote
    render/                畫面
      scene.js               水族箱繪製、魚的游動、點擊判定
      placeholder.js         占位圖（無美術時使用）
      assets.js              素材載入
      thumb.js               介面小圖
    ui/                    介面（HUD、面板、提示）
netlify/functions/         預留：後端 API
```

## 分層原則

```
config（規則數值）
   ↓
core（純計算） ←── services（存檔／帳號／時間）
   ↓
render（畫面） + ui（介面）
```

- `core/` 只做計算，可以原封不動搬到伺服器做驗證
- `render/` 只讀資料，不改數值；日後要換成 PixiJS／WebGL 只需重寫 `render/scene.js`
- 遊戲只透過 `services/` 存取需要後端的功能

## 規則摘要（目前實作）

| 項目 | 規則 |
|---|---|
| 資源 | 每隻水母每秒產出 = 種類成年產出 × 階段倍率 × (1 + 貓狗加成) |
| 成長 | 寶寶（產出 30%）→ 成長期（60%）→ 成年（100%），體型隨成長變大；長大時間依種類 5 分鐘～18 小時；沒有壽命、不會死亡 |
| 陸地寵物 | OREO（賓士貓，貓跳台頂層）、LUNA（虎斑貓，貓跳台第二層）、NANA（長毛臘腸，狗窩）；位置固定、提供全體產出加成、點擊互動有獎勵（冷卻 60 秒）。開始時三選一免費，其他各 5,000，每隻 +10% |
| 裝飾 | 房間背景：森林精靈屋免費、星空水晶館 500,000 解鎖，解鎖後可隨時切換 |
| 放生 | 點水母 →「放生」→ 確認，水母游向水面離開；不退還珍珠，圖鑑記錄累計放生數 |
| 圖鑑 | 記錄發現的種類、累計飼養數、累計放生數 |
| 離線 | 繼續累積，最多 6 小時 |
| 水族箱 | 最多 20 隻（測試模式 30 隻） |
| 數值 | 價格與收益見 [BALANCE.md](BALANCE.md)：偶爾上線約 30 天、常駐約 20 天收集完全部 |
| 等級 LV0～LV99 | 規劃中，升級方式待定 |
| 裝飾 | 預留：設定檔、存檔欄位、繪製圖層都已準備好，尚未開放 |

## 日後加入帳號／好友

1. 在 `netlify/functions/` 建立 API（建議端點見該資料夾 README）
2. 實作 `public/js/services/remote.js`
3. `services/index.js` 的 `BACKEND_MODE` 改為 `'remote'`
4. 存檔結構改變時：`core/state.js` 的 `SAVE_VERSION` +1，在 `migrate()` 加入轉換

## 本機測試

```bash
npm run serve      # 開啟 http://localhost:8080
npm run typecheck  # 型別檢查
```
