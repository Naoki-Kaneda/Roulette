# 技術仕様書 - Roulette Selector

**バージョン**: 1.0
**最終更新**: 2025年1月
**プロジェクト名**: ルーレット形式質問者決定アプリ

---

## 1. システム概要

### 1.1 目的
勉強会や発表会において、参加者の中からランダムに質問者を選出するためのWebアプリケーション。視覚的なルーレットアニメーションにより、イベントの盛り上がりを演出する。

### 1.2 アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                      ブラウザ (クライアント)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  index.html  │  │  style.css   │  │  script.js   │      │
│  │   (UI構造)    │  │  (スタイル)   │  │  (ロジック)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                │                │               │
│           └────────────────┼────────────────┘               │
│                            ▼                                │
│                 ┌────────────────────┐                      │
│                 │    appState        │                      │
│                 │  (アプリケーション状態) │                      │
│                 └────────────────────┘                      │
│                            │                                │
│           ┌────────────────┼────────────────┐               │
│           ▼                ▼                ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Canvas API   │  │  File API    │  │  DOM API     │      │
│  │ (ルーレット描画) │  │ (CSV読み込み) │  │ (UI更新)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                 ┌────────────────────┐
                 │  Firebase Hosting  │
                 │   (静的配信)        │
                 └────────────────────┘
```

### 1.3 技術スタック

| カテゴリ | 技術 | バージョン/詳細 |
|---------|------|---------------|
| マークアップ | HTML5 | セマンティックHTML |
| スタイル | CSS3 | カスタムプロパティ、Flexbox、Grid |
| ロジック | JavaScript | ES6+ (バニラJS) |
| フォント | Google Fonts | Outfit, Zen Kaku Gothic New |
| ホスティング | Firebase Hosting | 静的サイト配信 |
| 描画 | Canvas 2D API | ルーレットアニメーション |

---

## 2. ファイル構成

```
Roulette/
├── index.html                 # メインHTML (11.9KB)
├── script.js                  # メインJavaScript (23.2KB / 586行)
├── style.css                  # メインCSS (21KB / 1017行)
├── firebase.json              # Firebase設定
├── .firebaserc                # Firebaseプロジェクト設定
├── README.md                  # プロジェクト説明
├── docs/                      # ドキュメント
│   ├── TECHNICAL_SPEC.md      # 本ファイル
│   └── DEVELOPER_GUIDE.md     # 開発者ガイド
├── generate_data.js           # テストデータ生成 (Node.js)
├── generate_japanese_data.js  # 日本語テストデータ生成
├── test_*.csv                 # テストデータファイル群
└── index_gas.html             # Google Apps Script版
```

---

## 3. データモデル

### 3.1 参加者データ構造

```javascript
{
  id: string,           // 一意識別子 "participant_0", "manual_timestamp"
  name: string,         // 参加者名
  question: string,     // 質問内容（改行可）
  presenter: string,    // 宛先（発表者名）、空の場合は"All"
  excluded: boolean,    // 除外フラグ
  isManual: boolean     // 手動入力かどうか
}
```

### 3.2 アプリケーション状態 (appState)

```javascript
const appState = {
  // 参加者データ
  allParticipants: [],        // 全参加者配列
  currentParticipants: [],    // フィルタ後の現在の候補者
  manualParticipants: [],     // 手動入力の参加者

  // 発表者管理
  presenters: new Set(),      // 発表者セット
  currentPresenter: 'All',    // 現在選択中の発表者

  // ルーレット状態
  currentRotation: 0,         // 現在の回転角度
  isSpinning: false,          // スピン中フラグ

  // 当選管理
  globalWinners: new Set(),   // グローバル当選者（ID）
  excludedIDs: new Set(),     // 事前除外ID
  winnerCount: 1              // 当選人数 (1-3)
};
```

### 3.3 設定定数 (CONFIG)

```javascript
const CONFIG = {
  WHEEL_COLORS: [
    '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
    '#ef4444', '#06b6d4', '#f97316', '#ec4899'
  ],
  SPIN_DURATION: 5000,        // スピン時間 (ms)
  MIN_SPINS: 5,               // 最小スピン回数
  POINTER_ANGLES: {
    1: [270],                 // 1人選出時
    2: [270, 90],             // 2人選出時
    3: [270, 30, 150]         // 3人選出時
  },
  FONT_FAMILY_BODY: 'Zen Kaku Gothic New'
};
```

---

## 4. 主要機能の実装詳細

### 4.1 CSVパーサー

#### 対応フォーマット
- 4列CSV: 名前, 質問, 宛先, 除外フラグ
- クォート対応: `"値1","値2"`
- 改行対応: クォート内の改行を保持
- 文字コード: UTF-8推奨

#### パースアルゴリズム
```javascript
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    // クォート内の改行を処理
    // カンマ区切りで分割
    // 除外フラグの判定 (x, *, *)
  }

  return result;
}
```

### 4.2 ルーレット描画 (Canvas API)

#### 描画処理フロー
1. キャンバスクリア
2. 背景円の描画
3. セクション（扇形）の描画
4. テキストラベルの描画
5. 中央円の描画

```javascript
function drawRoulette() {
  const canvas = UI.roulette.canvas;
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;

  // 回転変換
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((appState.currentRotation * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);

  // セクション描画
  participants.forEach((p, index) => {
    const startAngle = (index * segmentAngle - 90) * Math.PI / 180;
    const endAngle = ((index + 1) * segmentAngle - 90) * Math.PI / 180;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.fillStyle = CONFIG.WHEEL_COLORS[index % 8];
    ctx.fill();
  });

  ctx.restore();
}
```

### 4.3 スピンアニメーション

#### アニメーション計算
- イージング関数: `easeOutCubic`
- 目標角度: ランダム + 最小回転数
- 複数当選: 各ポインター位置で独立計算

```javascript
function spinRoulette() {
  const spinAngle = 360 * CONFIG.MIN_SPINS + Math.random() * 360;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / CONFIG.SPIN_DURATION, 1);
    const eased = easeOutCubic(progress);

    appState.currentRotation = startRotation + spinAngle * eased;
    drawRoulette();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      determineWinners();
    }
  }

  requestAnimationFrame(animate);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
```

### 4.4 当選者判定

```javascript
function determineWinners() {
  const segmentAngle = 360 / participants.length;
  const winners = [];

  CONFIG.POINTER_ANGLES[winnerCount].forEach(pointerAngle => {
    // ポインター位置から逆算
    const normalizedRotation = (360 - (appState.currentRotation % 360) + pointerAngle) % 360;
    const winnerIndex = Math.floor(normalizedRotation / segmentAngle);
    winners.push(participants[winnerIndex]);
  });

  return winners;
}
```

---

## 5. UIコンポーネント

### 5.1 レイアウト構造

```
┌─────────────────────────────────────────────────────────────┐
│                        HEADER                               │
│                   Roulette Selector                         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     UPLOAD SECTION                          │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  CSVアップロード  │  │    手動入力     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTER TABS                            │
│  [ All ] [ 発表者A ] [ 発表者B ] [ ... ]                     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  SPLIT LAYOUT (PC: 2カラム / Mobile: 1カラム)                │
│  ┌──────────────────────┐ ┌──────────────────────┐         │
│  │   LEFT PANEL          │ │   RIGHT PANEL        │         │
│  │                       │ │                      │         │
│  │  - 設定トグル         │ │  ┌──────────────┐    │         │
│  │  - 当選人数選択       │ │  │   ROULETTE    │    │         │
│  │  - 候補者リスト       │ │  │   WHEEL       │    │         │
│  │  - 参加者追加         │ │  └──────────────┘    │         │
│  │                       │ │  [ START ] [RESET]  │         │
│  └──────────────────────┘ └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 モーダル

#### 当選結果モーダル
- 当選者名の表示
- 質問内容（改行保持、長文スクロール対応）
- コンフェッティエフェクト
- キーボード操作（Esc/Enter で閉じる）

#### ヘルプモーダル
- 4ステップの使い方説明
- キーボードショートカット案内

### 5.3 デザインシステム

#### カラーパレット
```css
:root {
  --bg-dark: #111111;          /* 背景色 */
  --bg-card: #222222;          /* カード背景 */
  --primary: #f59e0b;          /* プライマリ（オレンジ） */
  --secondary: #d97706;        /* セカンダリ */
  --text-main: #f8fafc;        /* メインテキスト */
  --text-muted: #9ca3af;       /* サブテキスト */
  --border: #404040;           /* ボーダー */
  --glass: rgba(34,34,34,0.8); /* ガラスモーフィズム */
}
```

#### タイポグラフィ
- 見出し: `Outfit` (Google Fonts)
- 本文: `Zen Kaku Gothic New` (Google Fonts)
- フォールバック: `sans-serif`

---

## 6. イベント処理

### 6.1 イベントリスナー一覧

| イベント | 要素 | 処理 |
|---------|------|------|
| `change` | ファイル入力 | CSV読み込み |
| `dragover/drop` | ドロップエリア | ファイルドロップ |
| `click` | 発表者タブ | フィルタ切替 |
| `click` | 当選人数ボタン | 人数設定 |
| `click` | START | スピン開始 |
| `click` | RESET | 状態リセット |
| `keydown` | document | Esc/Enterでモーダル閉じ |
| `input` | 検索ボックス | 候補者検索 |
| `change` | トグルスイッチ | 設定変更 |

### 6.2 キーボードショートカット

| キー | 機能 |
|------|------|
| `Escape` | モーダルを閉じる |
| `Enter` | 結果モーダルを閉じる（入力フィールド外） |

---

## 7. パフォーマンス考慮事項

### 7.1 最適化ポイント
- Canvas再描画の最小化（`requestAnimationFrame`使用）
- DOM操作のバッチ処理
- イベントデリゲーションの活用

### 7.2 制限事項
- 推奨参加者数: 100名以下
- テスト済み最大数: 100名
- ブラウザメモリ依存

---

## 8. セキュリティ

### 8.1 データ処理
- **すべてブラウザ内で完結**
- 外部サーバーへのデータ送信なし
- ローカルストレージ未使用（ページリロードでリセット）

### 8.2 入力検証
- CSVパース時のサニタイズ
- XSS対策（`textContent`使用）

---

## 9. ブラウザ互換性

| ブラウザ | バージョン | 対応状況 |
|---------|----------|---------|
| Chrome | 90+ | ✅ 完全対応 |
| Firefox | 88+ | ✅ 完全対応 |
| Safari | 14+ | ✅ 完全対応 |
| Edge | 90+ | ✅ 完全対応 |
| IE11 | - | ❌ 非対応 |

### 必要なAPI
- Canvas 2D API
- File API
- ES6+ (アロー関数、テンプレートリテラル、Set)
- CSS Custom Properties

---

## 10. デプロイメント

### 10.1 Firebase Hosting

```bash
# 初回セットアップ
firebase login
firebase init hosting

# デプロイ
firebase deploy --only hosting
```

### 10.2 除外ファイル設定 (firebase.json)
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "README.md",
      "docs/**",
      "generate_*.js",
      "test_*.csv"
    ]
  }
}
```

---

## 付録A: CSVフォーマット例

```csv
田中太郎,プロジェクトの進捗状況を教えてください,発表者A,
鈴木花子,"質問が複数行にわたる場合は
このようにクォートで囲みます",発表者B,
山田次郎,この人は最初から除外,発表者A,x
佐藤三郎,全員向けの質問です,,
```

---

## 付録B: 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2025-01 | 初版作成 |

---

*© 2024-2025 Roulette Project*
