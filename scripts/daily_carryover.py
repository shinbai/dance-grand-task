"""
③ 翌日タスク自動繰越
毎日 18:00 に実行

処理内容:
1. 今日の未完了タスクを確認
2. 期限切れ・未完了タスクを翌日に繰越
3. 翌日のシフトに基づき担当者を再アサイン（任意）
4. Slack にサマリーを通知
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from utils import (
    today_str, tomorrow_str, now_iso,
    get_tasks, save_tasks, get_users,
    add_log, slack_post
)
from shift_reader import get_staff_for_date
from datetime import datetime
import pytz

TZ = pytz.timezone("Asia/Tokyo")


def run():
    today    = today_str()
    tomorrow = tomorrow_str()
    now      = datetime.now(TZ)

    print(f"\n🌆 翌日タスク繰越処理開始: {today} → {tomorrow}\n")

    tasks     = get_tasks()
    all_users = get_users()

    # 今日のタスクを分類
    today_tasks     = [t for t in tasks if t.get("work_date") == today]
    done_tasks      = [t for t in today_tasks if t.get("status") == "done"]
    incomplete      = [t for t in today_tasks if t.get("status") != "done"]
    already_carried = [t for t in tasks if t.get("work_date") == tomorrow]

    print(f"📊 今日のタスク: {len(today_tasks)}件")
    print(f"  ✅ 完了: {len(done_tasks)}件")
    print(f"  ⏳ 未完了: {len(incomplete)}件")
    print(f"  📅 翌日に既存: {len(already_carried)}件")

    if not incomplete:
        msg = (
            f"🎉 *{today} の全タスク完了！お疲れ様でした* \n"
            f"✅ 完了: {len(done_tasks)}件\n"
            f"明日も頑張りましょう💪\n"
            f"🔗 https://dance-grand-task.vercel.app/"
        )
        slack_post(msg)
        print("✅ 未完了タスクなし")
        return

    # 翌日の出勤スタッフを取得
    tomorrow_staff = get_staff_for_date(tomorrow, all_users)
    tomorrow_names = {s["name"] for s in tomorrow_staff}

    # 繰越処理
    carried_tasks = []
    already_titles = {t["title"] for t in already_carried}

    updated_tasks = list(tasks)  # コピーして更新

    for t in incomplete:
        title = t["title"]

        # 同名タスクが翌日に既にあればスキップ
        if title in already_titles:
            print(f"  スキップ（翌日に存在）: {title}")
            continue

        # タスクを翌日に移動（元のタスクを更新）
        for i, orig in enumerate(updated_tasks):
            if orig["id"] == t["id"]:
                updated_tasks[i] = {
                    **orig,
                    "work_date": tomorrow,
                    "memo": (orig.get("memo","") + "\n📌 繰越").strip(),
                }
                carried_tasks.append(updated_tasks[i])
                break

    if not carried_tasks:
        print("繰越タスクなし（全て翌日に存在済み）")
        slack_post(
            f"📋 *{today} 繰越処理完了*\n"
            f"未完了 {len(incomplete)}件は翌日に既に登録されていました。\n"
            f"🔗 https://dance-grand-task.vercel.app/"
        )
        return

    save_tasks(updated_tasks)
    add_log("system", "task_update", f"翌日繰越: {len(carried_tasks)}件")

    # ── Slack 通知 ─────────────────────────────────
    user_map = {u["id"]: u["name"] for u in all_users}
    weekday_names = ["月","火","水","木","金","土","日"]
    tomorrow_dt = datetime.strptime(tomorrow, "%Y-%m-%d")
    tomorrow_label = f"{tomorrow_dt.month}/{tomorrow_dt.day}（{weekday_names[tomorrow_dt.weekday()]}）"

    lines = [
        f"📌 *本日の未完了タスクを {tomorrow_label} に繰越しました*",
        f"繰越: {len(carried_tasks)}件　|　完了: {len(done_tasks)}件",
        "",
        "*繰越タスク一覧:*",
    ]
    for t in carried_tasks:
        pri = {"high":"🔴","mid":"🟡","low":"🟢"}.get(t.get("priority","mid"),"🟡")
        assignees = [user_map.get(aid,"?") for aid in t.get("assignees",[])]
        a_str = ", ".join(assignees) if assignees else "未設定"
        lines.append(f"{pri} {t['title']}  →  {a_str}")

    lines += ["", f"🔗 https://dance-grand-task.vercel.app/"]
    slack_post("\n".join(lines))

    print(f"\n✅ {len(carried_tasks)}件を翌日（{tomorrow}）に繰越しました")


if __name__ == "__main__":
    run()
