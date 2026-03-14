# DG 簡単タスク管理 — 自動化スクリプト セットアップ手順

## 概要
GitHub Actions で以下の3つを自動実行します。

| スクリプト | 実行時刻 | 内容 |
|---|---|---|
| daily_assign.py | 毎朝 7:30 | シフト→タスク自動アサイン |
| daily_carryover.py | 毎夕 18:00 | 未完了タスクを翌日に繰越 |
| weekly_generate.py | 毎週金曜 17:00 | 翌週タスクを一括生成 |

---

## ステップ1: GitHub にアップロード

dance-grand-task リポジトリに以下のフォルダ構成でファイルをアップロード：

```
dance-grand-task/
├── .github/
│   └── workflows/
│       ├── daily-morning.yml
│       ├── daily-evening.yml
│       └── weekly.yml
├── scripts/
│   ├── utils.py
│   ├── shift_reader.py
│   ├── daily_assign.py
│   ├── daily_carryover.py
│   └── weekly_generate.py
├── requirements.txt
└── src/ （既存のアプリファイル）
```

---

## ステップ2: GitHub Secrets の設定

GitHub リポジトリの Settings → Secrets and variables → Actions → New repository secret

以下の5つを追加してください：

| Secret名 | 値の取得方法 |
|---|---|
| `SUPABASE_URL` | `https://jmfmvwjcyrwowdsunqti.supabase.co` |
| `SUPABASE_KEY` | Supabase の Settings → API → Publishable key |
| `SLACK_WEBHOOK` | 下記「Slack Webhook の取得方法」を参照 |
| `GOOGLE_SHEET_ID` | シフト表URLの `/d/` と `/edit` の間の文字列 |
| `GOOGLE_SHEET_GID` | シフト表URLの `gid=` 以降の数字（デフォルト: 0） |

---

## ステップ3: Slack Webhook の設定

1. https://api.slack.com/apps を開く
2. 「Create New App」→「From scratch」
3. App Name: `DG タスク通知`、ワークスペースを選択
4. 「Incoming Webhooks」→「Activate Incoming Webhooks」をON
5. 「Add New Webhook to Workspace」→通知を送るチャンネルを選択
6. 生成された `https://hooks.slack.com/services/...` の URL をコピー
7. GitHub Secrets の `SLACK_WEBHOOK` に貼り付け

---

## ステップ4: Google シフト表の公開設定

シフト表をスクリプトから読み取れるようにします。

**方法A（簡単）: 閲覧のみ公開**
1. シフト表スプレッドシートを開く
2. 「共有」→「リンクを知っている全員が閲覧可」に変更
3. URLから Sheet ID を取得してSecretに設定

**シフト表の形式（推奨）:**
```
A列: 日付（2026/3/14 形式）
B列以降: スタッフ名をヘッダーに（値は〇=出勤、×か空白=休み）
```
例:
| 日付 | けんいち | ゆきこ | かなた | ようこ |
|------|---------|--------|--------|--------|
| 2026/3/14 | 〇 | 〇 | × | 〇 |
| 2026/3/15 | × | 〇 | 〇 | 〇 |

---

## ステップ5: 手動テスト実行

設定完了後、GitHub Actions で手動実行してテストします：
1. GitHub リポジトリ → 「Actions」タブ
2. 「🌅 朝の日次タスク自動アサイン」を選択
3. 「Run workflow」→「Run workflow」をクリック
4. ログが緑になり Slack に通知が届けば成功！

---

## タスクの割り当てルール（カスタマイズ可能）

`daily_assign.py` と `weekly_generate.py` の `CATEGORY_RULES` を編集して
カテゴリごとの担当者を変更できます。

```python
CATEGORY_RULES = {
    "タスク管理":   ["けんいち", "ゆきこ"],  # 優先順に記述
    "SNS・広報":    ["ようこ", "まみ"],
    "生徒対応":     ["けんいち", "なつみ"],
    ...
}
```
