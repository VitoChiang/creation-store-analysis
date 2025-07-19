# 倉租分析系統

React + TypeScript + Vite 的倉儲租金分析系統

## 啟動指令

### 安裝依賴
```bash
npm install
```

### 開發模式
```bash
npm run dev
```
開發伺服器將在 http://localhost:5173 啟動

### 建置專案
```bash
npm run build
```

### 預覽建置結果
```bash
npm run preview
```

## GitHub Pages 部署

### 方法 1: 自動部署（推薦）

1. **推送代碼到 GitHub**：
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

2. **啟用 GitHub Pages**：
   - 進入 GitHub 倉庫設定頁面
   - 找到 "Pages" 設定
   - Source 選擇 "GitHub Actions"
   - 儲存設定

3. **自動部署**：
   - 每次推送到 `main` 分支時會自動觸發部署
   - GitHub Actions 會自動建置並部署到 GitHub Pages

### 方法 2: 手動部署

如果需要手動部署：
```bash
npm run deploy
```

### 訪問網站
部署完成後，可透過以下網址訪問：
```
https://您的用戶名.github.io/creation-store-analysis
```

## 部署指令說明

- `npm run predeploy`: 自動建置專案
- `npm run deploy`: 將 dist 目錄部署到 gh-pages 分支
- GitHub Actions: 自動建置和部署（推薦）

## 注意事項

- 確保 `data-07-19.xlsx` 檔案位於 `public` 目錄中
- 使用 Node.js 18+ 版本
- 專案使用 Vite 作為建置工具，支援熱更新
- 部署前請先提交所有變更到主分支