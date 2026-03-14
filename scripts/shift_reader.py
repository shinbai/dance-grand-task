"""
シフト表読み込みモジュール（実際のシート形式対応版）

【にゅうシフト表の実際の構造】
- シート名: 26.3月分, 26.4月分, 26.5月分 ...（月ごと）
- 4行目: 日付ヘッダー（例: 3/1(日), 3/2(月) ...）
- A列: スタッフ名（漢字）
- セル値: 「出勤」「出勤〜16:00」→ 出勤 / 空白・試合・留学 → 休み

【スタッフ名マッピング（シート名漢字 → アプリ名ひらがな）】
"""
import os, re, io, csv
from datetime import datetime
import pytz

TZ = pytz.timezone("Asia/Tokyo")

SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "1gRtvHhnCK1qCvgq2kGhbzfn1PiQKYe4rACFDlMOClOI")

# シートのスタッフ名（漢字）→ アプリのユーザー名（ひらがな）
STAFF_NAME_MAP = {
    "金光":    "しんすけ",
    "真美":    "まみ",
    "新井":    "けんいち",
    "由紀子":  "ゆきこ",
    "中川":    "ともひろ",
    "桃子":    "ももこ",
    "なつみ":  "なつみ",
    "高橋":    "かなた",
    "河邊":    "としや",
    "大久保":  "まゆか",
    "舞雪花":  "まいか",
    "愛":      "あい",
    "舞華":    "かずき",
    "岩井":    "ようこ",
    "ジョエル": "ジョエル",
    "洋子":    "ようこ",
}

WORKING_KEYWORDS     = ["出勤", "出"]
NOT_WORKING_KEYWORDS = ["試合", "留学", "欠勤", "休", "×"]

# 月ごとのシートGID（毎月追加してください）
MONTH_GIDS = {
    "2026-01": os.environ.get("SHEET_GID_2026_01", ""),
    "2026-02": os.environ.get("SHEET_GID_2026_02", ""),
    "2026-03": os.environ.get("SHEET_GID_2026_03", "218278675"),
    "2026-04": os.environ.get("SHEET_GID_2026_04", ""),
    "2026-05": os.environ.get("SHEET_GID_2026_05", ""),
}


def fetch_sheet_csv(gid: str) -> list:
    import requests
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    r.encoding = "utf-8"
    reader = csv.reader(io.StringIO(r.text))
    return list(reader)


def normalize_date_header(raw: str) -> str:
    """3/14(土) → 2026-03-14"""
    raw = raw.strip()
    m = re.match(r"(\d{1,2})/(\d{1,2})", raw)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        now = datetime.now(TZ)
        year = now.year
        if month < now.month - 2:
            year += 1
        elif month > now.month + 2:
            year -= 1
        return f"{year}-{month:02d}-{day:02d}"
    return raw


def is_working(cell_value: str) -> bool:
    v = cell_value.strip()
    if not v:
        return False
    for kw in NOT_WORKING_KEYWORDS:
        if kw in v:
            return False
    for kw in WORKING_KEYWORDS:
        if kw in v:
            return True
    return False


def get_staff_for_date(target_date: str, all_users: list) -> list:
    dt = datetime.strptime(target_date, "%Y-%m-%d")
    month_key = f"{dt.year}-{dt.month:02d}"
    gid = MONTH_GIDS.get(month_key, "")

    if not gid:
        print(f"⚠️ {month_key} のGID未設定 → 全スタッフを返します")
        return all_users

    try:
        rows = fetch_sheet_csv(gid)
    except Exception as e:
        print(f"⚠️ シフト表取得失敗: {e} → 全スタッフを返します")
        return all_users

    app_user_map = {u["name"]: u for u in all_users}

    # 日付ヘッダー行と列を特定
    date_row_idx = date_col_idx = None
    for row_idx, row in enumerate(rows[:8]):
        for col_idx, cell in enumerate(row):
            if normalize_date_header(cell) == target_date:
                date_row_idx, date_col_idx = row_idx, col_idx
                break
        if date_row_idx is not None:
            break

    if date_row_idx is None:
        print(f"⚠️ {target_date} の列が見つかりません → 全スタッフを返します")
        return all_users

    print(f"📅 日付列: row={date_row_idx}, col={date_col_idx}")

    working_staff = []
    for row in rows[date_row_idx + 1:]:
        if not row or not row[0].strip():
            continue
        sheet_name = row[0].strip()
        if date_col_idx >= len(row):
            continue
        cell_value = row[date_col_idx]
        if not is_working(cell_value):
            continue
        app_name = STAFF_NAME_MAP.get(sheet_name)
        if not app_name:
            continue
        user = app_user_map.get(app_name)
        if user:
            working_staff.append(user)
            print(f"  ✅ {sheet_name}（{app_name}）← {cell_value}")

    return working_staff if working_staff else all_users
