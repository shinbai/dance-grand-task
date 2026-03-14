"""
④ 週間タスク自動生成
毎週金曜 17:00 に実行

処理内容:
1. 翌週のシフトをGoogle Sheetsから取得
2. 曜日ごとの定型業務パターンに基づきタスクを生成
3. シフトと照合して担当者を割り当て
4. Supabase に一括登録
5. Slack に翌週のタスク一覧を通知
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from utils import (
    uid, now_iso,
    get_tasks, save_tasks, get_templates, get_users,
    add_log, slack_post
)
from shift_reader import get_staff_for_date
from datetime import datetime, timedelta
import pytz

TZ = pytz.timezone("Asia/Tokyo")

WEEKDAY_NAMES = ["月", "火", "水", "木", "金", "土", "日"]

# 曜日ごとに生成するテンプレートカテゴリ
WEEKLY_PATTERN = {
    0: ["タスク管理", "SNS・広報"],        # 月曜
    1: ["生徒対応", "施設・備品"],          # 火曜
    2: ["研修・育成", "タスク管理"],        # 水曜
    3: ["SNS・広報", "生徒対応"],           # 木曜
    4: ["タスク管理", "イベント", "SNS・広報"], # 金曜
    5: ["SNS・広報", "施設・備品", "生徒対応"], # 土曜
    6: ["生徒対応"],                        # 日曜
}

# カテゴリ別の優先担当者
CATEGORY_RULES = {
    "タスク管理":   ["けんいち", "ゆきこ", "しんすけ"],
    "SNS・広報":    ["ようこ", "まみ"],
    "生徒対応":     ["けんいち", "ゆきこ", "なつみ"],
    "施設・備品":   ["ともひろ", "かなた"],
    "研修・育成":   ["ともひろ", "ももこ", "なつみ"],
    "イベント":     ["しんすけ", "まみ", "けんいち"],
}


def get_next_week_dates() -> list[str]:
    """翌週の月曜〜日曜の日付リストを返す"""
    today = datetime.now(TZ)
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    next_monday = today + timedelta(days=days_until_monday)
    return [(next_monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]


def pick_assignee(category: str, working_staff: list, all_users: list) -> dict | None:
    preferred = CATEGORY_RULES.get(category, [])
    working_names = {s["name"] for s in working_staff}
    for name in preferred:
        if name in working_names:
            return next((u for u in all_users if u["name"] == name), None)
    for user in working_staff:
        if user.get("role") in ("admin","manager","submanager"):
            return user
    return working_staff[0] if working_staff else None


def run():
    now = datetime.now(TZ)
    next_week = get_next_week_dates()
    week_label = f"{datetime.strptime(next_week[0],'%Y-%m-%d').strftime('%-m/%-d')}〜{datetime.strptime(next_week[6],'%Y-%m-%d').strftime('%-m/%-d')}"

    print(f"\n📅 週間タスク自動生成開始: 翌週 {week_label}\n")

    all_users = get_users()
    templates = get_templates()
    tasks     = get_tasks()

    if not all_users or not templates:
        print("❌ データ取得失敗")
        return

    # 既存タスクのタイトル×日付セット（重複防止）
    existing = {(t["title"], t.get("work_date","")) for t in tasks}

    new_tasks   = []
    day_summary = {}  # 日付 → タスク一覧

    for date_str in next_week:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        weekday = dt.weekday()

        # その日の出勤スタッフ
        working_staff = get_staff_for_date(date_str, all_users)
        if not working_staff:
            continue

        target_cats = WEEKLY_PATTERN.get(weekday, ["タスク管理"])
        day_tasks   = []

        for tpl in templates:
            cat = tpl.get("cat","")
            if cat not in target_cats:
                continue
            title = tpl.get("title","")
            if not title:
                continue
            if (title, date_str) in existing:
                continue

            assignee = pick_assignee(cat, working_staff, all_users)
            task = {
                "id":          uid(),
                "title":       title,
                "description": "",
                "status":      "todo",
                "assignees":   [assignee["id"]] if assignee else [],
                "priority":    tpl.get("priority","mid"),
                "work_date":   date_str,
                "due_at":      "",
                "tags":        tpl.get("tags",[]),
                "memo":        "🤖 週間自動生成",
                "attachments": [],
                "created_by":  "system",
                "created_at":  now_iso(),
                "_assignee_name": assignee["name"] if assignee else "未設定",
            }
            day_tasks.append(task)
            new_tasks.append(task)
            existing.add((title, date_str))

        if day_tasks:
            day_summary[date_str] = day_tasks

    if not new_tasks:
        msg = f"📅 翌週（{week_label}）のタスクは既に登録済みです"
        slack_post(msg)
        print(msg)
        return

    # Supabase 保存
    clean_tasks = [{k:v for k,v in t.items() if not k.startswith("_")} for t in new_tasks]
    save_tasks(tasks + clean_tasks)
    add_log("system", "monthly_gen", f"週間自動生成: {len(new_tasks)}件（{week_label}）")

    # ── Slack 通知 ─────────────────────────────────
    lines = [
        f"📅 *翌週（{week_label}）のタスクを自動生成しました*",
        f"合計 {len(new_tasks)}件",
        "",
    ]
    for date_str, dtasks in day_summary.items():
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        d_label = f"{dt.month}/{dt.day}（{WEEKDAY_NAMES[dt.weekday()]}）"
        lines.append(f"*{d_label}*  {len(dtasks)}件")
        for t in dtasks[:3]:  # 各日最大3件表示
            pri = {"high":"🔴","mid":"🟡","low":"🟢"}.get(t.get("priority","mid"),"🟡")
            lines.append(f"  {pri} {t['title']} → {t['_assignee_name']}")
        if len(dtasks) > 3:
            lines.append(f"  …他 {len(dtasks)-3}件")
        lines.append("")

    lines.append(f"🔗 https://dance-grand-task.vercel.app/")
    slack_post("\n".join(lines))

    print(f"\n✅ 翌週分 {len(new_tasks)}件のタスクを自動生成しました")


if __name__ == "__main__":
    run()
