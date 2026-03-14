"""
② 日次タスク自動アサイン
毎朝 7:30 に実行

処理内容:
1. Google スプレッドシートから今日の出勤スタッフを取得
2. テンプレートをもとに今日の定型タスクを生成
3. 出勤スタッフに自動アサイン
4. Supabase に保存
5. Slack に本日のタスク一覧を通知

タスクの割り当てルール:
- 「タスク管理」カテゴリ → マネージャー（けんいち or ゆきこ）に優先
- 「SNS・広報」カテゴリ → ようこに優先
- 「生徒対応」カテゴリ → マネージャーに優先
- 上記に該当しない場合は出勤スタッフに順番に割り当て
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from utils import (
    uid, today_str, now_iso,
    get_tasks, save_tasks, get_templates, get_users,
    add_log, slack_post
)
from shift_reader import get_staff_for_date
from datetime import datetime
import pytz

TZ = pytz.timezone("Asia/Tokyo")

# ── 割り当てルール ─────────────────────────────────
CATEGORY_RULES = {
    "タスク管理":   ["けんいち", "ゆきこ", "しんすけ", "まみ"],
    "SNS・広報":    ["ようこ", "まみ", "けんいち"],
    "生徒対応":     ["けんいち", "ゆきこ", "なつみ"],
    "施設・備品":   ["ともひろ", "かなた", "としや"],
    "研修・育成":   ["ともひろ", "ももこ", "なつみ"],
    "イベント":     ["けんいち", "ゆきこ", "しんすけ"],
}

# 毎日自動生成するテンプレートカテゴリ
DAILY_CATEGORIES = ["タスク管理", "生徒対応", "SNS・広報"]

# 曜日ごとの追加カテゴリ（0=月, 6=日）
WEEKDAY_EXTRA = {
    0: ["SNS・広報"],          # 月曜: SNS強化
    1: ["施設・備品"],          # 火曜: 施設チェック
    2: ["研修・育成"],          # 水曜: 研修
    3: ["SNS・広報"],           # 木曜
    4: ["イベント"],            # 金曜: イベント確認
    5: ["SNS・広報", "施設・備品"], # 土曜
    6: ["生徒対応"],            # 日曜
}


def pick_assignee(category: str, working_staff: list, all_users: list) -> dict | None:
    """カテゴリと出勤状況から最適な担当者を選ぶ"""
    preferred_names = CATEGORY_RULES.get(category, [])
    working_names = {s["name"] for s in working_staff}

    # 優先順位リストの中で出勤中の人を選ぶ
    for name in preferred_names:
        if name in working_names:
            for user in all_users:
                if user["name"] == name:
                    return user

    # 優先候補がいなければマネージャー以上から選ぶ
    for user in working_staff:
        if user.get("role") in ("admin", "manager", "submanager"):
            return user

    # それでもいなければ最初の出勤スタッフ
    return working_staff[0] if working_staff else None


def run():
    today = today_str()
    now = datetime.now(TZ)
    weekday = now.weekday()  # 0=月曜
    weekday_names = ["月", "火", "水", "木", "金", "土", "日"]

    print(f"\n🌅 日次タスク自動アサイン開始: {today}（{weekday_names[weekday]}曜日）\n")

    # データ取得
    all_users   = get_users()
    templates   = get_templates()
    tasks       = get_tasks()

    if not all_users:
        print("❌ ユーザーデータが取得できません")
        return

    # 今日の出勤スタッフを取得
    working_staff = get_staff_for_date(today, all_users)
    working_names = [s["name"] for s in working_staff]
    print(f"📋 本日の出勤スタッフ（{len(working_staff)}名）: {', '.join(working_names)}")

    # 今日すでにあるタスクのタイトルセット（重複防止）
    today_task_titles = {
        t["title"] for t in tasks
        if t.get("work_date") == today
    }

    # 今日生成するカテゴリを決定
    target_categories = list(set(
        DAILY_CATEGORIES + WEEKDAY_EXTRA.get(weekday, [])
    ))
    print(f"📂 本日対象カテゴリ: {', '.join(target_categories)}")

    # テンプレートからタスクを生成
    new_tasks = []
    skipped   = []

    for tpl in templates:
        cat = tpl.get("cat", "")
        if cat not in target_categories:
            continue

        title = tpl.get("title", "")
        if not title:
            continue

        # 既に同じタイトルのタスクがあればスキップ
        if title in today_task_titles:
            skipped.append(title)
            continue

        assignee = pick_assignee(cat, working_staff, all_users)
        assignee_id = assignee["id"] if assignee else None
        assignee_name = assignee["name"] if assignee else "未設定"

        task = {
            "id":          uid(),
            "title":       title,
            "description": "",
            "status":      "todo",
            "assignees":   [assignee_id] if assignee_id else [],
            "priority":    tpl.get("priority", "mid"),
            "work_date":   today,
            "due_at":      "",
            "tags":        tpl.get("tags", []),
            "memo":        tpl.get("memo", "") + "\n🤖 自動生成" if tpl.get("memo") else "🤖 自動生成",
            "attachments": [],
            "created_by":  "system",
            "created_at":  now_iso(),
        }
        task["_assignee_names"] = assignee_name  # Slack通知用（保存しない）
        new_tasks.append(task)

    if not new_tasks:
        msg = f"✅ {today}（{weekday_names[weekday]}）は新規タスクなし（既存 {len(skipped)}件 スキップ）"
        print(msg)
        slack_post(msg)
        return

    # Supabase に保存（_assignee_names は除外）
    tasks_to_save = []
    for t in new_tasks:
        t_clean = {k: v for k, v in t.items() if not k.startswith("_")}
        tasks_to_save.append(t_clean)

    save_tasks(tasks + tasks_to_save)
    add_log("system", "task_add", f"日次自動生成: {len(new_tasks)}件")

    # ── Slack 通知 ─────────────────────────────────
    date_label = now.strftime(f"%-m/%-d（{weekday_names[weekday]}）")
    lines = [
        f"🌅 *{date_label} 本日のタスク自動生成完了*",
        f"出勤: {', '.join(working_names)}",
        f"生成: {len(new_tasks)}件　|　スキップ: {len(skipped)}件",
        "",
    ]
    for t in new_tasks:
        pri = {"high":"🔴","mid":"🟡","low":"🟢"}.get(t.get("priority","mid"),"🟡")
        lines.append(f"{pri} {t['title']}  →  {t['_assignee_names']}")

    lines.append("")
    lines.append(f"🔗 https://dance-grand-task.vercel.app/")

    slack_post("\n".join(lines))
    print(f"\n✅ {len(new_tasks)}件のタスクを自動生成しました")
    for t in new_tasks:
        print(f"  ・{t['title']} → {t['_assignee_names']}")


if __name__ == "__main__":
    run()
