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

### 1. 準備 GitHub 倉庫
1. 在 GitHub 建立新的倉庫（例如：creation-store-analysis）
2. 將本地代碼推送到 GitHub

### 2. 更新設定
將 `package.json` 中的 `homepage` 改為您的 GitHub 用戶名：
```json
"homepage": "https://您的用戶名.github.io/creation-store-analysis"
```

### 3. 部署到 GitHub Pages
```bash
npm run deploy
```

### 4. 啟用 GitHub Pages
1. 進入 GitHub 倉庫設定頁面
2. 找到 "Pages" 設定
3. Source 選擇 "Deploy from a branch"
4. Branch 選擇 "gh-pages"
5. 儲存設定

### 5. 訪問網站
部署完成後，可透過以下網址訪問：
```
https://您的用戶名.github.io/creation-store-analysis
```

## 部署指令說明

- `npm run predeploy`: 自動建置專案
- `npm run deploy`: 將 dist 目錄部署到 gh-pages 分支

## 注意事項

- 確保 `data-07-19.xlsx` 檔案位於 `public` 目錄中
- 使用 Node.js 18+ 版本
- 專案使用 Vite 作為建置工具，支援熱更新
- 部署前請先提交所有變更到主分支