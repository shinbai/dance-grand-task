"""
DG 簡単タスク管理 — 共通ユーティリティ
Supabase / Slack / Google Sheets 接続
"""
import os, json, uuid, requests
from datetime import datetime, date, timedelta
import pytz

# ── 設定 ──────────────────────────────────────────
SUPABASE_URL  = os.environ["SUPABASE_URL"]   # GitHub Secrets
SUPABASE_KEY  = os.environ["SUPABASE_KEY"]   # GitHub Secrets
SLACK_WEBHOOK = os.environ["SLACK_WEBHOOK"]  # GitHub Secrets
TABLE         = "dg_store"
TZ            = pytz.timezone("Asia/Tokyo")

# ── ヘルパー ───────────────────────────────────────
def uid():
    return "id_" + str(int(datetime.now().timestamp() * 1000)) + "_" + uuid.uuid4().hex[:4]

def today_str():
    return datetime.now(TZ).strftime("%Y-%m-%d")

def tomorrow_str():
    return (datetime.now(TZ) + timedelta(days=1)).strftime("%Y-%m-%d")

def now_iso():
    return datetime.now(TZ).isoformat()

# ── Supabase ───────────────────────────────────────
HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

def sb_get(key: str, fallback=None):
    """Supabase から key に対応する value を取得"""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{TABLE}?key=eq.{key}&select=value",
        headers=HEADERS, timeout=10
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        return fallback
    return rows[0]["value"]

def sb_set(key: str, value):
    """Supabase に key-value を upsert"""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"},
        json={"key": key, "value": value},
        timeout=10
    )
    r.raise_for_status()
    return r.json()

# ── タスク操作 ─────────────────────────────────────
def get_tasks():
    return sb_get("dgprod_t", [])

def save_tasks(tasks: list):
    sb_set("dgprod_t", tasks)

def get_templates():
    data = sb_get("dgprod_tpl", None)
    # null の場合はデフォルトテンプレートを返す
    if data is None:
        return []
    return data

def get_users():
    return sb_get("dgprod_u", [])

def add_log(who_name: str, action: str, detail: str):
    logs = sb_get("dgprod_log", [])
    entry = {
        "id":     uid(),
        "at":     now_iso(),
        "who":    "system",
        "name":   who_name,
        "action": action,
        "detail": detail,
    }
    logs = [entry] + logs[:299]  # 最大300件
    sb_set("dgprod_log", logs)

# ── LINE 通知 ──────────────────────────────────────
LINE_CHANNEL_TOKEN = os.environ.get("LINE_CHANNEL_TOKEN", "")
LINE_GROUP_ID      = os.environ.get("LINE_GROUP_ID", "")

def line_push(text: str):
    """LINE Messaging API でグループにプッシュ送信"""
    if not LINE_CHANNEL_TOKEN or not LINE_GROUP_ID:
        print("⚠ LINE_CHANNEL_TOKEN / LINE_GROUP_ID が未設定のためスキップ")
        return
    r = requests.post(
        "https://api.line.me/v2/bot/message/push",
        headers={
            "Authorization": f"Bearer {LINE_CHANNEL_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "to": LINE_GROUP_ID,
            "messages": [{"type": "text", "text": text}],
        },
        timeout=10,
    )
    r.raise_for_status()

# ── Slack 通知 ─────────────────────────────────────
def slack_post(text: str, blocks: list = None):
    """Slack Incoming Webhook に投稿"""
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    r = requests.post(SLACK_WEBHOOK, json=payload, timeout=10)
    r.raise_for_status()

def slack_task_report(title: str, tasks: list, extra_text: str = ""):
    """タスク一覧を見やすいSlackメッセージで送信"""
    lines = [f"*{title}*"]
    if extra_text:
        lines.append(extra_text)
    lines.append("")
    for t in tasks:
        priority_emoji = {"high": "🔴", "mid": "🟡", "low": "🟢"}.get(t.get("priority","mid"), "🟡")
        assignee_names = t.get("_assignee_names", "未設定")
        lines.append(f"{priority_emoji} *{t['title']}*  →  担当: {assignee_names}")
    slack_post("\n".join(lines))
