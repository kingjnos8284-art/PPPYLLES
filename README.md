# PPPYLLES

輕鬆放置的觀賞型水族養成網頁遊戲，電腦與手機皆可遊玩、滿版顯示。

- 15 種水母在水族箱裡漂浮，一點一點累積珍珠
- 貓咪 OREO、LUNA 與臘腸狗 NANA 住在房間裡，可以點擊互動
- 水族圖鑑、放生
- 離線也會繼續累積，最多 6 小時

## 文件

- [架構說明](docs/ARCHITECTURE.md)：資料夾結構、規則摘要、後端預留方式
- [美術素材規格](docs/ASSET_SPEC.md)：背景、魚、陸地寵物的尺寸與格式

## 開發

不需要安裝任何套件。

```bash
npm run serve      # 本機預覽 http://localhost:8080
npm run typecheck  # 型別檢查（需要 TypeScript）
```

遊戲規則數值都在 `public/js/config/`。

## 部署

Netlify，發佈資料夾 `public/`，無建置步驟（設定見 `netlify.toml`）。
