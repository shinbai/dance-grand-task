"""
タスク進捗レポート — LINE グループに送信
16:00 中間報告 / 20:00 最終報告

使い方:
  python scripts/task_report.py midday   # 16:00 中間報告
  python scripts/task_report.py final    # 20:00 最終報告
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from utils import (
    today_str, get_tasks, get_users, line_push,
)
from datetime import datetime
import pytz

TZ = pytz.timezone("Asia/Tokyo")
WEEKDAY_NAMES = ["月", "火", "水", "木", "金", "土", "日"]


def build_report(report_type: str) -> str:
    today = today_str()
    now = datetime.now(TZ)
    wd = WEEKDAY_NAMES[now.weekday()]
    date_label = f"{now.month}/{now.day}（{wd}）"

    tasks = get_tasks()
    users = get_users()
    user_map = {u["id"]: u["name"] for u in users}

    today_tasks = [t for t in tasks if t.get("work_date") == today]
    done = [t for t in today_tasks if t.get("status") == "done"]
    in_progress = [t for t in today_tasks if t.get("status") == "doing"]
    todo = [t for t in today_tasks if t.get("status") == "todo"]

    total = len(today_tasks)
    done_count = len(done)
    pct = round(done_count / total * 100) if total else 0

    if report_type == "midday":
        title = f"📊 {date_label} 16:00 中間報告"
    else:
        title = f"📋 {date_label} 20:00 最終報告"

    lines = [title, f"達成率: {pct}%（{done_count}/{total}件完了）", ""]

    if done:
        lines.append(f"✅ 完了（{len(done)}件）")
        for t in done:
            names = _assignee_str(t, user_map)
            lines.append(f"  ・{t['title']}（{names}）")
        lines.append("")

    if in_progress:
        lines.append(f"🔄 進行中（{len(in_progress)}件）")
        for t in in_progress:
            names = _assignee_str(t, user_map)
            lines.append(f"  ・{t['title']}（{names}）")
        lines.append("")

    if todo:
        lines.append(f"⏳ 未着手（{len(todo)}件）")
        for t in todo:
            names = _assignee_str(t, user_map)
            lines.append(f"  ・{t['title']}（{names}）")
        lines.append("")

    if report_type == "final":
        if pct == 100:
            lines.append("🎉 本日のタスクは全て完了！お疲れ様でした！")
        elif pct >= 80:
            lines.append("💪 あと少し！もうひと頑張りです！")
        else:
            remaining = total - done_count
            lines.append(f"📌 残り{remaining}件のタスクがあります。確認をお願いします。")

    lines.append("")
    lines.append("🔗 https://dance-grand-task.vercel.app/")

    return "\n".join(lines)


def _assignee_str(task: dict, user_map: dict) -> str:
    names = [user_map.get(aid, "?") for aid in task.get("assignees", [])]
    return "・".join(names) if names else "未設定"


def run():
    report_type = sys.argv[1] if len(sys.argv) > 1 else "midday"
    if report_type not in ("midday", "final"):
        print(f"❌ 不正な引数: {report_type}（midday / final のみ）")
        sys.exit(1)

    print(f"📤 {report_type} レポート生成中...")
    msg = build_report(report_type)
    print(msg)
    print()

    line_push(msg)
    print("✅ LINE グループに送信しました")


if __name__ == "__main__":
    run()
