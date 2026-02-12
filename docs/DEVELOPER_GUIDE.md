# 開発者ガイド - Roulette Selector

このドキュメントは、Roulette Selectorの開発・保守・拡張を行う開発者向けのガイドです。

---

## 目次

1. [開発環境のセットアップ](#1-開発環境のセットアップ)
2. [プロジェクト構造](#2-プロジェクト構造)
3. [コードアーキテクチャ](#3-コードアーキテクチャ)
4. [主要コンポーネントの解説](#4-主要コンポーネントの解説)
5. [カスタマイズガイド](#5-カスタマイズガイド)
6. [テスト方法](#6-テスト方法)
7. [デプロイ手順](#7-デプロイ手順)
8. [トラブルシューティング](#8-トラブルシューティング)
9. [コーディング規約](#9-コーディング規約)
10. [貢献ガイドライン](#10-貢献ガイドライン)

---

## 1. 開発環境のセットアップ

### 1.1 必要なツール

| ツール | 用途 | 必須/任意 |
|--------|------|----------|
| モダンブラウザ | 動作確認 | 必須 |
| テキストエディタ/IDE | コード編集 | 必須 |
| Node.js | テストデータ生成 | 任意 |
| Firebase CLI | デプロイ | 任意 |
| Git | バージョン管理 | 推奨 |

### 1.2 ローカル開発の開始

```bash
# リポジトリのクローン
git clone <repository-url>
cd Roulette

# ブラウザで直接開く（最も簡単な方法）
# index.html をダブルクリック、または：
start index.html      # Windows
open index.html       # macOS
xdg-open index.html   # Linux
```

### 1.3 ローカルサーバーでの実行（推奨）

ファイルプロトコル制限を避けるため、ローカルサーバーの使用を推奨します。

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code Live Server拡張機能
# index.html を右クリック → "Open with Live Server"
```

その後、`http://localhost:8080` にアクセスします。

### 1.4 Firebase CLIのセットアップ（デプロイ用）

```bash
# Firebase CLIのインストール
npm install -g firebase-tools

# ログイン
firebase login

# プロジェクトの確認
firebase projects:list
```

---

## 2. プロジェクト構造

```
Roulette/
│
├── index.html              # メインHTML（エントリーポイント）
├── script.js               # アプリケーションロジック
├── style.css               # スタイルシート
│
├── docs/                   # ドキュメント
│   ├── TECHNICAL_SPEC.md   # 技術仕様書
│   └── DEVELOPER_GUIDE.md  # 本ファイル
│
├── firebase.json           # Firebase Hosting設定
├── .firebaserc             # Firebaseプロジェクト設定
│
├── generate_data.js        # テストデータ生成（英語）
├── generate_japanese_data.js # テストデータ生成（日本語）
│
├── test_*.csv              # テスト用CSVファイル
│   ├── test_japanese_100.csv   # 日本語100件
│   ├── test_long_questions.csv # 長文テスト
│   ├── test_large_50.csv       # 大規模データ
│   └── test_exclusion.csv      # 除外フラグテスト
│
├── index_gas.html          # Google Apps Script版（参考）
└── README.md               # プロジェクト説明
```

---

## 3. コードアーキテクチャ

### 3.1 設計パターン

このプロジェクトは**シングルページアプリケーション (SPA)** パターンを採用し、状態管理には単一の`appState`オブジェクトを使用しています。

```
┌─────────────────────────────────────────────────────────┐
│                     script.js                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   CONFIG    │    │  appState   │    │     UI      │ │
│  │  (設定定数)  │    │ (状態管理)   │    │ (DOM参照)   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│                            │                            │
│                            ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │              イベントハンドラー                      │  │
│  │  - handleFiles()                                  │  │
│  │  - spinRoulette()                                │  │
│  │  - selectPresenter()                             │  │
│  │  - ...                                           │  │
│  └──────────────────────────────────────────────────┘  │
│                            │                            │
│                            ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │              UI更新関数                            │  │
│  │  - drawRoulette()                                │  │
│  │  - updateCandidateList()                         │  │
│  │  - renderManualList()                            │  │
│  │  - ...                                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 データフロー

```
入力 (CSV/手動)
      │
      ▼
┌─────────────┐
│  parseCSV() │ または addManualEntry()
└─────────────┘
      │
      ▼
┌─────────────────────────────┐
│  appState.allParticipants   │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  initPresenterTabs()        │ ← 発表者タブ生成
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  selectPresenter()          │ ← フィルタリング
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  appState.currentParticipants   │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  updateCandidateList()      │ ← UI更新
│  drawRoulette()             │ ← ルーレット描画
└─────────────────────────────┘
```

---

## 4. 主要コンポーネントの解説

### 4.1 CONFIG オブジェクト

アプリケーション全体の設定値を管理します。

```javascript
const CONFIG = {
  // ルーレットの色（8色のローテーション）
  WHEEL_COLORS: [
    '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
    '#ef4444', '#06b6d4', '#f97316', '#ec4899'
  ],

  // スピンの持続時間（ミリ秒）
  SPIN_DURATION: 5000,

  // 最小回転数（見栄えのため）
  MIN_SPINS: 5,

  // ポインターの配置角度
  POINTER_ANGLES: {
    1: [270],           // 上部に1つ
    2: [270, 90],       // 上と下
    3: [270, 30, 150]   // 3方向
  },

  // 本文用フォント
  FONT_FAMILY_BODY: 'Zen Kaku Gothic New'
};
```

**カスタマイズ例：**
- スピン時間を変更: `SPIN_DURATION: 3000` (3秒)
- 色を変更: `WHEEL_COLORS` 配列を編集

### 4.2 appState オブジェクト

アプリケーションの状態を一元管理します。

```javascript
const appState = {
  // 参加者データ
  allParticipants: [],      // CSV + 手動入力のすべて
  currentParticipants: [],  // 現在表示中（フィルタ後）
  manualParticipants: [],   // 手動入力のみ

  // 発表者
  presenters: new Set(),    // 発表者名のセット
  currentPresenter: 'All',  // 現在選択中

  // ルーレット
  currentRotation: 0,       // 回転角度
  isSpinning: false,        // スピン中フラグ

  // 当選管理
  globalWinners: new Set(), // 当選者ID
  excludedIDs: new Set(),   // 除外ID
  winnerCount: 1            // 当選人数
};
```

### 4.3 UI オブジェクト

DOM要素への参照をキャッシュします。

```javascript
const UI = {
  upload: {
    csvMode: document.getElementById('csvMode'),
    manualMode: document.getElementById('manualMode'),
    // ...
  },
  roulette: {
    canvas: document.getElementById('rouletteWheel'),
    // ...
  },
  // ...
};
```

### 4.4 主要関数

#### CSVパース
```javascript
function parseCSV(text) {
  // CSVテキストを参加者オブジェクト配列に変換
  // - クォート対応
  // - 改行対応
  // - 除外フラグ処理
}
```

#### ルーレット描画
```javascript
function drawRoulette() {
  // Canvas 2D APIを使用してルーレットを描画
  // - 背景
  // - セクション（扇形）
  // - テキストラベル
  // - 中央円
}
```

#### スピン処理
```javascript
function spinRoulette() {
  // アニメーションループ
  // - requestAnimationFrame使用
  // - easeOutCubicイージング
  // - 当選者判定
}
```

---

## 5. カスタマイズガイド

### 5.1 色のカスタマイズ

**style.css** のCSS変数を編集：

```css
:root {
  --bg-dark: #111111;      /* 背景色 */
  --bg-card: #222222;      /* カード背景 */
  --primary: #f59e0b;      /* アクセントカラー */
  --secondary: #d97706;    /* セカンダリ */
  --text-main: #f8fafc;    /* メインテキスト */
  --text-muted: #9ca3af;   /* サブテキスト */
}
```

### 5.2 ルーレット色の変更

**script.js** の `CONFIG.WHEEL_COLORS` を編集：

```javascript
WHEEL_COLORS: [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DFE6E9', '#74B9FF', '#A29BFE'
],
```

### 5.3 スピン時間の調整

```javascript
// 短くする（3秒）
SPIN_DURATION: 3000,

// 長くする（10秒）
SPIN_DURATION: 10000,
```

### 5.4 当選人数の上限変更

現在は最大3人ですが、拡張する場合：

1. **script.js** の `POINTER_ANGLES` に追加：
```javascript
POINTER_ANGLES: {
  1: [270],
  2: [270, 90],
  3: [270, 30, 150],
  4: [270, 0, 90, 180],  // 4人用
},
```

2. **index.html** にボタン追加
3. **style.css** にポインター追加

### 5.5 フォントの変更

**index.html** のGoogle Fonts読み込みを変更：

```html
<link href="https://fonts.googleapis.com/css2?family=Your+Font&display=swap" rel="stylesheet">
```

**style.css** で適用：

```css
body {
  font-family: 'Your Font', sans-serif;
}
```

---

## 6. テスト方法

### 6.1 テストデータの生成

```bash
# 英語テストデータ
node generate_data.js

# 日本語テストデータ
node generate_japanese_data.js
```

### 6.2 手動テスト項目

| テスト項目 | 確認内容 |
|-----------|---------|
| CSV読み込み | ドラッグ&ドロップ、ファイル選択 |
| 改行処理 | CSV内の改行が保持されるか |
| 除外フラグ | x, *, * で除外されるか |
| 発表者フィルタ | タブ切替で正しくフィルタ |
| 複数当選 | 1/2/3人の選出が正常か |
| キーボード操作 | Esc/Enterでモーダル閉じ |
| レスポンシブ | モバイル表示の確認 |

### 6.3 テストCSVファイル

| ファイル | 用途 |
|---------|------|
| test_japanese_100.csv | 大量データテスト |
| test_long_questions.csv | 長文・改行テスト |
| test_exclusion.csv | 除外フラグテスト |

---

## 7. デプロイ手順

### 7.1 Firebase Hosting

```bash
# ログイン（初回のみ）
firebase login

# デプロイ
firebase deploy --only hosting

# 特定のプロジェクトにデプロイ
firebase deploy --only hosting --project roulette2025-a774a
```

### 7.2 デプロイ時の除外ファイル

`firebase.json` で設定済み：

```json
{
  "hosting": {
    "ignore": [
      "firebase.json",
      "**/.*",
      "README.md",
      "docs/**",
      "generate_*.js",
      "test_*.csv",
      "index_gas.html"
    ]
  }
}
```

### 7.3 他のホスティングサービス

静的ファイルのみなので、以下でも動作します：

- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront

---

## 8. トラブルシューティング

### 8.1 よくある問題

#### CSV読み込みエラー
**症状**: ファイルが読み込めない
**原因**: 文字コードの問題
**解決**: UTF-8で保存し直す

#### ルーレットが表示されない
**症状**: 空白のキャンバス
**原因**: 参加者が0人
**解決**: CSVを読み込むか手動で追加

#### スピンが途中で止まる
**症状**: アニメーションが不完全
**原因**: ブラウザのバックグラウンド処理
**解決**: タブをアクティブに保つ

#### 日本語が文字化け
**症状**: 文字が□や?になる
**原因**: CSVの文字コード
**解決**: UTF-8(BOMなし)で保存

### 8.2 デバッグ方法

```javascript
// コンソールで状態確認
console.log(appState);

// 特定の参加者を確認
console.log(appState.allParticipants);

// 現在のフィルタ結果
console.log(appState.currentParticipants);
```

---

## 9. コーディング規約

### 9.1 JavaScript

- ES6+構文を使用
- 変数宣言は `const` / `let` を使用（`var` 禁止）
- 関数はアロー関数または `function` 宣言
- コメントは日本語で記述

```javascript
// 良い例
const processData = (data) => {
  // データを処理する
  return data.filter(item => item.active);
};

// 悪い例
var processData = function(data) {
  return data.filter(function(item) { return item.active; });
};
```

### 9.2 CSS

- BEM命名規則に準拠
- CSS変数を活用
- コメントは日本語

```css
/* コンポーネント: ボタン */
.btn {
  /* 基本スタイル */
}

.btn--primary {
  /* プライマリバリアント */
}

.btn__icon {
  /* 子要素 */
}
```

### 9.3 HTML

- セマンティックタグを使用
- アクセシビリティ属性を追加
- インデントは2スペース

---

## 10. 貢献ガイドライン

### 10.1 ブランチ戦略

```
main          ← 本番環境
  └── feature/xxx  ← 機能開発
  └── fix/xxx      ← バグ修正
  └── docs/xxx     ← ドキュメント
```

### 10.2 コミットメッセージ

```
feat: 新機能の説明
fix: バグ修正の説明
docs: ドキュメント更新
style: コードフォーマット
refactor: リファクタリング
test: テスト追加・修正
chore: その他の変更
```

### 10.3 プルリクエスト

1. 機能ブランチを作成
2. 変更を実装
3. テストを実施
4. PRを作成し、レビューを依頼

---

## 付録: 便利なスニペット

### A. 新しい参加者を追加

```javascript
appState.allParticipants.push({
  id: `custom_${Date.now()}`,
  name: '新規参加者',
  question: '質問内容',
  presenter: 'All',
  excluded: false,
  isManual: true
});
updateCandidateList();
drawRoulette();
```

### B. 状態をリセット

```javascript
appState.allParticipants = [];
appState.currentParticipants = [];
appState.presenters.clear();
appState.globalWinners.clear();
```

### C. デバッグ用ログ出力

```javascript
// 開発時に追加
console.log('Current state:', JSON.stringify(appState, null, 2));
```

---

*© 2024-2025 Roulette Project*
