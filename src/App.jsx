import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ══════════════════════════════════════════
// 🔧 Supabase 設定（URLとキーを入力してください）
// ══════════════════════════════════════════
const SUPABASE_URL  = "https://jmfmvwjcyrwowdsunqti.supabase.co";
const SUPABASE_ANON = "sb_publishable_2f6b_a_uDuX2sj0aqe2pWw_gciGh8OP";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
// ══════════════════════════════════════════

/* ── utils ── */
const uid = () => "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
const TD = new Date().toISOString().slice(0, 10);
const da = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dnow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 16); };
const fmt = (s) => s ? new Date(s).toLocaleDateString("ja", { month: "numeric", day: "numeric" }) : "";
const fmtDT = (s) => s ? new Date(s).toLocaleString("ja", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const isOvd = (t) => t.status !== "done" && t.due_at && new Date(t.due_at) < new Date();

/* ── storage ── */
const SK = { u: "dgprod_u", t: "dgprod_t", po: "dgprod_po", memo: "dgprod_memo", rules: "dgprod_rules", tpl: "dgprod_tpl", log: "dgprod_log" };
const LOG_MAX = 300; // 最大保持件数
async function addLog(user, action, detail) {
  if (!user) return;
  const logs = await dbGet(SK.log, []);
  const entry = {
    id: uid(),
    at: new Date().toISOString(),
    who: user.id,
    name: user.name,
    action,   // "task_add" | "task_update" | "task_delete" | "task_status" | "pool_update" | "member_update"
    detail,   // 人間が読める説明
  };
  const next = [entry, ...logs].slice(0, LOG_MAX);
  await dbSet(SK.log, next);
}
const ACTION_LABELS = {
  task_add:      "✅ タスク追加",
  task_update:   "✏️ タスク編集",
  task_delete:   "🗑 タスク削除",
  task_status:   "🔄 ステータス変更",
  pool_update:   "🏊 プール更新",
  member_update: "👥 メンバー更新",
  monthly_gen:   "🔁 月次タスク生成",
};
// Supabase 読み込み（なければフォールバック値を返す）
async function dbGet(k, fb) {
  try {
    const { data, error } = await sb.from("dg_store").select("value").eq("key", k).single();
    if (error || !data) return fb;
    return data.value ?? fb;
  } catch { return fb; }
}

// Supabase 書き込み（upsert = なければ追加・あれば更新）
async function dbSet(k, v) {
  try {
    await sb.from("dg_store").upsert({ key: k, value: v }, { onConflict: "key" });
  } catch {}
}

/* ── constants ── */
const MC = ["#60A5FA", "#F9FAFB", "#93C5FD", "#C4B5FD", "#86EFAC", "#FCA5A5", "#67E8F9", "#FDBA74"];
const getMC = (id, us) => MC[(us || []).findIndex((u) => u.id === id) % MC.length] || MC[0];
const ROLES = { admin: "管理者", manager: "マネージャー", submanager: "サブマネージャー", staff: "スタッフ" };
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const PRIS = [
  { id: "high", label: "高", color: "#FCA5A5" },
  { id: "mid",  label: "中", color: "#93C5FD" },
  { id: "low",  label: "低", color: "#86EFAC" },
];
const STATS = [
  { id: "todo",  label: "未着手", color: "#7B96CC", icon: "○", next: "doing" },
  { id: "doing", label: "着手中", color: "#60A5FA", icon: "◑", next: "done"  },
  { id: "done",  label: "完了",   color: "#86EFAC", icon: "●", next: "todo"  },
];
const PCATS = [
  { id: "project",  label: "プロジェクト", color: "#C4B5FD", icon: "🏗" },
  { id: "event",    label: "イベント",     color: "#FCA5A5", icon: "🎪" },
  { id: "routine",  label: "定期業務",     color: "#86EFAC", icon: "🔄" },
  { id: "longterm", label: "長期課題",     color: "#60A5FA", icon: "📌" },
  { id: "training", label: "研修・育成",   color: "#67E8F9", icon: "📚" },
];
const TPRE = ["生徒対応", "SNS", "広報", "経理", "イベント", "シフト", "研修", "備品"];
const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAATrElEQVR42u2be5QdVZX/P3ufqlu3b+dBAumk053wCASIDIHg8BiQMDMCoiiOGIco0J0ogRl8zKA/AUFCO46DD0ZREAcCSQCZkQRUfsOADyBRQeQtvxAEgkCS7oQ8JJ3udN97q87Z80fdpEFgRggEWL/6rNUrK7erb5065+zv3mfvXVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQsEOZq4C8nZ9A3t5jn6GwTuAoYLnBIv+ChVEgQFcoNuqbtZFaOz5O2yfaX/yhydvJGt8mFjJXYbnAoq273WCGY/zwo1B2Bd9MYD+0NIfMT0dCP658AGn/vTx33bLGc9rrO56Xtbztvo+8AQMUmO5yGWGrlISXGajAXHn1kjLDMb68ExL/CI2OeNE8hHoGdi2azEITyLbUCOFo1iz4JcxwQ5K2PcyJ4YqU1o8ejsY70b3wlsZ3h9dj0d32D3CGg++G/N8ZAksNng2wtPGz3IauW/5HA15q/+tmmTKjRHzowQx/50TifXsZ/I8qw6ddSVQ+nlCrE7IAvorEJUL6S4TfY2wk1O7AVQ7F0oi+h38IY1w+ru3ZdHtHcEVK28fa0eY7wPfQ99slcEQED/j8mqXbtSjR9i3EIs/4ymlo52ZWL7geINdwfzJoGfH94Jbh3S9Yc8VAw5IMMEZ/bATNbgKrrnk013l56YPs+amE3r4voMxCdAJNyQrGnTIT4QB8PQUT1MVIKcbqDxOlf8PK65/PxzFrKhKfgbAOpkfQ5IDsT1MNAy4UWKKNjeMblhxom3UIcB1aasHXe/Lrnw+M/tgImp69iG7+fnvkazsWZEpD7mQsUr6ctlkHgF3JyN5n6R1WxpXmYgHwoNnTtHXMpbvrWqbMKLF8UZ1yfC6BvYEPwVEvN1nGirUZY8Z8ncqWfyHz3yPaqQM2/R2wCZfEBAN4kpDeBuFRrLmT8R2DqGSYnE3Wfy/dW87OJ/SPv3+rX9r6HMsNplg+8dLwUwxZ1PjZByLMBuYglAiDgP42v26Rp9z5dbCZMPeT2zbdDvQhAnMddGWMP/UjuPIPMAPLBkFvI9owG7/ToRD9J+Y9oiUkBl/9JD0LL6N1TgWtr8BwVIZPZMV36kPO+iVSEeX36VxIVDkVP3AxyF8j+jzYkxgeOAQtTUMcWAYhXYfIT7Dsl5hGCB5YRRLfze9bt0CXf+UJm+EYm+yMRu2ITkbCO0GOBN6JloRQq6NJCV+7hZ4Fx+fW2NmFNl2AH7yHni1H5MpxyoEQ7UXP/Btejf/aXqcujJu1C2pPIlKB4NCyEtLnqLIXif8HXPlL+GoNcRFghHQScRTh7Uk0VkJ6It0LbsplZWn2srK453sSBsZdCeF5iB5DQ0aQGJE2JAzHbDiiIzHWga0DFcwOR/Wv0DifeqvfQOrP5rmFzwAw8RO7k9l+kO0D2obYeGAsZq2ItCA6EokaCubBMgMbRMsVQvoY1I5By4cT7JOIHIFE4Ktz6Vn4pVy+yneDv43uBZ/btqneAMnKdXHirD0I/WtYPaXG2q71tHV8By2fT6jWCTVDk7GUq7cQcQxZ/ZOoayGEGq6cYP50am4ecVDMDDgf7IeNqOwFujtXocvT1nEoVXcmwjSQsRB2hhicQqhvwPR2kDuxkCAyG6KpaJKrjWXg64OYfz89C2+n/dQ22mZ/AewEvP8zXNQE5SHjNAMJYAEsBKwewAwTQ1BcpYKv3QW1k5Dy95DS+5AaYAFfX0PPwD/TfurBmPserukdhL5/e4OjrEYUUTlgPyidTd8lNwNQnnwfIu9HS+PBG5YFtGl3smwJUEOTQ7DMI0SYjQSuh3A6+AhNWhm2uJ++m3+Vh5QPhG1hdGvn19D4asTtD2EM4iqIQvCPYNlPEHkI8BjDwR5H5C5M12C1RyH7PXA/IZxFNnA/ow65GHGXofHxQBuEiOAzzGeYD5AFCPkC5L4j5HtDIlwSgSiWfpWQnYOWFiClY/GDg4g4UI+FUxlZ7sB0HqJthLrHyefpfXh9vtn+tOhLXpv/mO5o260Hie9D/f9h5fzljD25hThZBjKGkFVxSYKvXYfyfSS5jVDNQBxowNlksnAlWjoKyzJQxbL35Lt4RhOrFw3S3vEptPJt/GCGkeFKZSx7gmBXgBmiu4O1Y7YHsBeu3NS4xyOYLAWupefqh3KHPOsKFDDzSHwaZG5oL271v/KCKRGQxkE81FLQGwnZpYiOQuW74CYQ6jVckmChDxucCfGJuMossoE6UVOJbPCb9Cw469Wef17DgjS0fnzHZ4lHfIOsrx9xP4HwHeq1VZSa7gXdGctSsF5cdDA+uxvRFkLIcOUSYeAskCfQyn/iB2qoK2HSj9U/RM+1P6d1TgWpP4nqOCxkaKlEyH7AYG0OpVKC2F/g9FDMJgLdYJswHYPY+9FkElrK5SobGERlI8gThPQaJP4aMArCSqAPswhkFGCI+VyvpB9jIyJPYdyPhJWIjsOsA1c5EsuGFtHsdnz9Mlw8E22aQaiBCIT6VTQNP5MVo9NXG3G9RguZK7QvT7DKr9BkWh7eCpCehlT/C6vcipT2z0/P1dMxYqJhl5JtqaKaYGwgq++Oc7fgytPx1RrqEowMC58BuxvRB8ECWnKEdBHd8/82TyY2dtu4WWNwzAS5KI+t7WZgKaggoYVgoxFGIlrH2IDoSZjcg6W/A2lCZRPBHkL778KGzUBkH8yvbURtHnW7EORJfLqMuPRNzO+B2XpUBjF9DLG78RZQOR2YDLYMeBj0OrqvemQHp04aGj+2YzdidysS7UNIPRo7QnYZOvAVQtM/Iu5zAIT0QNB/Jiq/l2xgEJc0EdJ5hPgzqH8KdePwtVoeHkeCpecAX0DccELopmf+hG233nn2cEp+f9YsvCuXo1MOROJ70KgECn7gRnqu+XD+u85LUHcSErUQ0ssIvoKLOgDNQ+QA2K1Y6AL5J1zlaEK1IVe6dbf/mqz+cdT9JRrtSfAVCBuJ0qvIkgsRnsWy50GbQXYBSSCsQnQcnsWsnb90B4W9DelqnbkL2nQR8FHUNaFN4Ps3QjiHEDbjmuZg2d6E9EwkPhOXHEOog0Rgg58n3byQaPTP0fjPCNUMiQOhfj7IyUSV/fADVxC4DScVAjshOhvz4+hZMAE6yrCwSlvHZUjpjNxQwuN0l6bC40bb7vfgmg4iG3wU7AZcuYtQ60WikbmkImhTRBi4m+rz76G8yzdR93FCWsNMEUCTGPPrsPQiiC7EJSPyI2N1AWb/D42+imuK8sVtnCO1DOnzj1HVQ9g4Ycurka3tyGU18kL9ywboe+hmhu1/I9hThPpaIEP0SJA6We1baHwDxj5kA19BuRujmZDughv2ATRqxdKz8+hG9yeqJIT6cLAf4JqOwdfuwrlv4ZpPxCXvw7KxmH2BvocfgMnG2GkVNBoG9kFEHGZr6Gu/HBZ6Rkwt4yrHYbX1iN1C4Fwy/QYayog7LA9pswxNdsPFHsJKzJ5GS4c2oi2HZRkSjUDYDe/PQTgasgRxByCsx/x5WFhFSD0hi7FsHaH6fao6k41X98FS3mAfsi0knYYLz7H6mu6XXDL25Bai+CDEjsRkEoQNmNQQyTC7H1hFbMupMw4tTSdkm1nTfwOt5TZcdBLE78eq/wZyGFDGCIibgNj/hWwZq69dmofIrZ7Wp9+Nk70JfBpX3hNf+w09Cw7blklu6/wMcDLBn0hJN/Pswk356brjASSeRshquCTG1+aBtIMNIPYoWp5LqNvWQ0luKekSQvqvaHIpEk9EFPxAL8iNYCsQtwiXrebZhdXXms96DbmsJXklTsJUKH2L8Z0/BlmBWIbZrogcDOyLRkkePtpQKKllyPo2Efzn8NEIHB/C/L6o7UzbsIsQ3YhlX6T7iq/R9onT8LVLUcpo5QysehNmVcy9J3ferXnCz3Wei9n1iPwe0T0Ri/NJWJJnn7sXXAIzLqV1VEJaf4TWzjNZM/+nMOsRxE2DzHKHYcMQHiIacR5+0/X42meR6F9QKRFSw9fquPJRCJvIqscR8zd4OwF0N4RjsPAkq1c8k2cbpkeN/NmOSC4u9YBQixZTzr5M1HxK7hMaxmY+//FpPV84IjSOCFmGpV9Hsh+h0Rkgs5BGTlGSrX93Oeb+wIQzHsbSgHNPIaWrsXQ4QRYTJT/F13/B2JObyVYpScc5aPNR+P4ujLW5jrt30DrrCNbM/9XQmBd5pOMjRMMn4ftPggt/BpYMHUTEgOcwKljmCe7PEWvFqqcTktlo8i4sQKimaOmDIJOx7LN0D1z0Ms5aXpoCemOzvQZzlY1dfbR3fhBfvQF1u2EZ28JfiUA1j3pCPSP4HxDCZYjsj0Q/ReORhFpGyNJGxPUUcBrin8DkJjSeSjb4lyCfJqrsSu0Pl6F6NKihciTiHsMFxZXa8ANVkNFg9UbUFOP4EW2zvkSwX+FwBPsgop/FMkPsuTyj23kA5gFzEATT+5DwD1hwmC1G+Dau+a/wtS7MFmHMQKJ3gYArT0HcrbTrRph9J4QfMmLLYpYvSt/EiuHW0PfkFqLSmcDxYO1ADWwD6O8Qux0f7sJZC7guJDmKUAOzKqplNAFfvxlfPReNPo3g0eTv8dVnMDkOlXvQZDihugjkWVzl8/gtA6CVxhlF8fUlYL9B6cb02/mJkAgtQUgbT+m2HuYCab2VSA9Ck//CN07bof4AlnURjbyZrP9O4E6EXtBvoKUYX7sTdUswfz+ikwhhP4TmXBbkacwvpmfhb185Y73DSrh/VFvetWMn0rAvlAWpB0TfgfG3iB6dpyGyOqqlXKLq68Cfh+dBXOl6rP4c8Adc8wlkW5aQbvkApeY1SDQMwgZCmI3IV3HlffOdrRDSTajvxHMxQf+aKHSilQvzRfcNaxWQGMxvwdLjkWg12D0YwxBJQDbj0/ei8fdyS6/PweS7EO4HW4RElyNxXqiy+q346MN5se2NYTtLuEsbHnt6BJ3Qe8kgIw/YA+QCxH0F1/wBJJqUy7TQCEufgnAJ+C+BTEP0GlRbsHB+XvzRCoR7GV1fTDXeAHo0rjICS/8CfBfI4+AfQ7gV6l8kcCAi70b4daOuPg9x+zR8xACwCsL1hOppmGtH5WZgFzSOMOshpKfh3KfQqBXf+16I3oWrHAvsgYWn8aELlYPAj8FV9oL6eYw4cDTDDuxl5J4b2XyEwPFsb+n2jeo6GQrzxs3elUj2xUILIcSo24SGdWRiKEcAZ6ClXZEYss1fBNmAK1+eF5iyz6GsJTAFladBx2EyAsK9dM9fzJ6fShjsPQvckyDzMH8XQTuJ3DrMf4bu+d+mtfMENN6DUN+M2CjEnYRrPggC+KpHmEd9YC5x6Vhwo+kPC+hduCmvvbTeRDzivWS9P6V7wbG0Hl9Bx0wHpmLWgmjA+AWV5p80imv2ek7gG9Cy85KTqdDWeS7ITDTeDy2DpbnGm/9X6v1zKQ17FC1NJFQfRPTLWOgE6UNKJ2K1H+eWgWBMw8Xvw9dvAjPiESeS9XXh3Xxc+D7R8MPx/UvAbsR0AjANwmSQFFgB8gtMF7NT7zP0jjgBs+NRm4ixW+7/9E6y7KuUouMIvo1xpS4euCJ9cxvOXtdeqlHKQcCawd3R+N0YU8irQt2Y/yG28QncLnegzYfgq1WCPwa1M9BkJr5+AqLfIh6xRx5B0Sg6Dc7Dwu9w5W8Qan2YfRo4COxnuPKPG9ETWLgf+C2wFizDJANrQmR/TA5Ho1H5LMhQ7kpKkG3uw/dPYu2i9UMbbIYO1d+3tTf5t9GC/AmMP+UwJL4S2BXsDizMBdmI6kpwhqU/o5Z2kjT9HRJGAqvx/g4kPIO4p9DSCELt1yAXI/G/Ux4Yw0D0H7jkOEKthsTJUIT1gloHAUIdIDTKyP0NR/8MsAUtTSJk99Ez8cuNBj2/o6Yk2oHT/0cNdICsWIVLPsCW2no2zu/b1vozuPk+osqfk6bL2fD9NcAFL/qm9o6LkNLIxv8exKyFqFJisD6XmA/h/Uo0GYOv1xoncXlRNUpI0JISskEszEPcpay+asXr3YX4Vl8Qy0+wS4c+6Wb1iyVujWPFd2q0dp6BT3+OWG/es3VhAksy2FvgccPkWMgMKQnGM6iMJVQNic/Cpw9SrU4lKd+MK78zr8Q25lUaFhLqfVj271h6Md3XPjF0/619WC22I63izVqQVy520WXbGtFAWLPgQVpnHIBr2q2xuWvbwuzWORWs1gIm+a+0itkoBMN8isTXkeg/0r3iMNr3fDdmHwabnKcRZCWBX2PZLay5duVQZ8uUF97/zZ6QtyIv28zcGOsMpa15GchkNFH84OcR1uKGXUPWP4hIjCYRIb0b4wJ6rr79lTsvty3EW4a3cPf73IZ8vHDCGkWxts4vo8l5mA9YtpiRW05hU/MviZoOJtQg+BSN47zil3Uj+gC+/nXWrLwHWhSmZG/V90bebi/s5BK3x/LhVJuX4pqm4ge70S17MTg8osz5CB/N6xpbPZcNYnYNmc5lXfv67WnzLBbkf5KziR9rJSQ34YYdiu87m9Xzv7at5t7k9sF8C0aVTJax7qrnKNgBcrZrR5n20y6gbdZvmHDqpLxl85X8xdtj872N3zF84SsM0yPGtJRZv6g///wjOnTdDeFlX3UoeMMOm1ExDYWlFxQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFPx/zH8DZIUGL9jvadUAAAAASUVORK5CYII=";


/* ── design tokens ── */
const T = {
  bg:   "#FFFFFF",
  bg2:  "#F8FAFF",
  bg3:  "#EEF2FF",
  bg4:  "#E0E7FF",
  bd:   "#CBD5E1",
  bd2:  "#E2E8F0",
  tx:   "#0F172A",
  dim:  "#475569",
  dimmer: "#94A3B8",
  navy: "#001B60",
  red:  "#B91C1C",
  font: "'Inter','Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",
};
const IS = {
  width: "100%", background: "#FFFFFF", border: `1.5px solid ${T.bd}`,
  borderRadius: 8, padding: "9px 12px", color: T.tx, fontSize: 14,
  outline: "none", boxSizing: "border-box", fontFamily: T.font,
};
const bP = {
  padding: "9px 20px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg,#001B60,#1E3A8A)",
  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: T.font,
};
const bO = (c) => ({
  padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${c}`,
  background: "#FFFFFF", color: c, fontSize: 13, cursor: "pointer", fontFamily: T.font,
});
const bSm = (c) => ({
  padding: "4px 9px", borderRadius: 6, border: `1px solid ${c}55`,
  background: c + "12", color: c, fontSize: 11, fontWeight: 700,
  cursor: "pointer", fontFamily: T.font,
});

/* ── init data ── */
const USERS = [
  { id: "u1",  name: "しんすけ", role: "admin",   team: "代表・ディレクター",   is_active: true },
  { id: "u2",  name: "まみ",     role: "admin",   team: "代表・ディレクター",   is_active: true },
  { id: "u3",  name: "けんいち", role: "manager", team: "マネージャー",         is_active: true },
  { id: "u4",  name: "ゆきこ",   role: "manager", team: "マネージャー",         is_active: true },
  { id: "u5",  name: "ともひろ", role: "submanager", team: "インストラクター",   is_active: true },
  { id: "u6",  name: "ももこ",   role: "submanager", team: "インストラクター",   is_active: true },
  { id: "u7",  name: "かなた",   role: "staff",   team: "インストラクター",     is_active: true },
  { id: "u8",  name: "としや",   role: "staff",   team: "インストラクター",     is_active: true },
  { id: "u9",  name: "まゆか",   role: "staff",   team: "インストラクター",     is_active: true },
  { id: "u10", name: "まいか",   role: "staff",   team: "インストラクター",     is_active: true },
  { id: "u11", name: "なつみ",   role: "submanager", team: "インストラクター",   is_active: true },
  { id: "u12", name: "あい",     role: "staff",   team: "インストラクター",     is_active: true },
  { id: "u13", name: "かずき",   role: "staff",   team: "インストラクター",     is_active: true },
  { id: "u14", name: "ようこ",   role: "staff",   team: "スタッフ",             is_active: true },
  { id: "u15", name: "ジョエル", role: "staff",   team: "インストラクター",     is_active: true },
];
const TASKS = [];
const POOL = [];
const IRULES = [
  { id: "r1", title: "翌月シフトリリース",    dayType: "date",     day: 20, weekday: 1, assignee: "u1", priority: "high", tags: ["シフト"], memo: "LINE・掲示板にも告知" },
  { id: "r2", title: "報酬請求書の提出",      dayType: "by",       day: 10, weekday: 1, assignee: "u3", priority: "high", tags: ["経理"],   memo: "10日締め切り" },
  { id: "r3", title: "翌月シフト提出〆切",    dayType: "by",       day: 15, weekday: 1, assignee: "u1", priority: "mid",  tags: ["シフト"], memo: "全スタッフに前日リマインド" },
  { id: "r4", title: "月次棚卸し・在庫確認",  dayType: "lastWeek", day: 20, weekday: 1, assignee: "u4", priority: "mid",  tags: ["備品"],   memo: "消耗品・備品リスト更新" },
  { id: "r5", title: "月次収支レポート作成",  dayType: "date",     day: 25, weekday: 1, assignee: "u3", priority: "high", tags: ["経理"],   memo: "当月の入出金を集計" },
];
const ITPL = [
  { id: "tp1",  cat: "SNS・広報",  icon: "📱", title: "X運用：コラム投稿",                      priority: "mid",  tags: ["SNS","広報"], memo: "XDGHアカウントでコラム→Xポスト" },
  { id: "tp2",  cat: "SNS・広報",  icon: "🎬", title: "YouTubeショート・Google動画アップ",       priority: "mid",  tags: ["YouTube"],    memo: "" },
  { id: "tp3",  cat: "SNS・広報",  icon: "📅", title: "週間カレンダー更新",                      priority: "mid",  tags: ["広報"],       memo: "" },
  { id: "tp4",  cat: "SNS・広報",  icon: "🎬", title: "エンジョイダンスレクチャー編集&YouTube",  priority: "mid",  tags: ["YouTube"],    memo: "" },
  { id: "tp5",  cat: "生徒対応",   icon: "📞", title: "お問い合わせ対応",                       priority: "high", tags: ["生徒対応"],   memo: "当日の問い合わせ・見学対応" },
  { id: "tp6",  cat: "生徒対応",   icon: "🎭", title: "ロープレ（入会コース紹介）",              priority: "mid",  tags: ["研修"],       memo: "" },
  { id: "tp7",  cat: "生徒対応",   icon: "📄", title: "入会コースフライヤー作成",               priority: "mid",  tags: ["生徒対応"],   memo: "" },
  { id: "tp8",  cat: "タスク管理", icon: "✅", title: "今日のタスクチェック＆明日のタスク作成",  priority: "high", tags: ["管理"],       memo: "毎日必須：翌日タスクを前日に準備" },
  { id: "tp9",  cat: "タスク管理", icon: "📅", title: "来週の週間タスク作成",                   priority: "mid",  tags: ["管理"],       memo: "" },
  { id: "tp10", cat: "タスク管理", icon: "💰", title: "報酬請求書の提出",                       priority: "high", tags: ["経理"],       memo: "10日締め切り" },
  { id: "tp11", cat: "施設・備品", icon: "🔑", title: "レンタルフロア準備",                     priority: "high", tags: ["施設"],       memo: "鍵番号を事前確認" },
  { id: "tp12", cat: "施設・備品", icon: "🛒", title: "備品・消耗品の購入",                     priority: "mid",  tags: ["備品"],       memo: "コーヒー豆・文具等" },
  { id: "tp13", cat: "施設・備品", icon: "🏷️", title: "B2鍵ナンバー設定・テプラ作成",           priority: "high", tags: ["施設"],       memo: "鍵ラベル「B2トイレ」「B2フロア」" },
  { id: "tp14", cat: "研修・育成", icon: "📚", title: "新人スタッフ研修",                       priority: "mid",  tags: ["研修"],       memo: "" },
  { id: "tp15", cat: "研修・育成", icon: "🌟", title: "インストラクターへの道",                  priority: "mid",  tags: ["研修","育成"], memo: "" },
  { id: "tp16", cat: "イベント",   icon: "🎪", title: "グランタイム準備",                       priority: "high", tags: ["イベント"],   memo: "公式LINEにお知らせ投稿も" },
  { id: "tp17", cat: "イベント",   icon: "📢", title: "エンジョイナイト再告知",                  priority: "mid",  tags: ["イベント"],   memo: "" },
];

/* ── monthly task generation ── */
function getRuleDate(r, y, m) {
  if (r.dayType === "date" || r.dayType === "by") {
    const d = Math.min(r.day, new Date(y, m, 0).getDate());
    return new Date(y, m - 1, d).toISOString().slice(0, 10);
  }
  let d = new Date(y, m, 0);
  while (d.getDay() !== r.weekday) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function genMonthlyTasks(rules, tasks, y, m) {
  const tag = `__m_${y}_${String(m).padStart(2, "0")}`;
  if (tasks.some((t) => (t.tags || []).includes(tag))) return [];
  return rules.map((r) => ({
    id: uid(), title: r.title, status: "todo",
    assignees: r.assignee ? [r.assignee] : [],
    priority: r.priority,
    work_date: getRuleDate(r, y, m),
    due_at: new Date(getRuleDate(r, y, m) + "T18:00:00").toISOString().slice(0, 16),
    tags: [...(r.tags || []), tag],
    memo: r.memo || "", attachments: [],
    created_by: "system", created_at: new Date().toISOString(), from_rule: r.id,
  }));
}

/* ── context ── */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ── shared UI ── */
function Toast({ msg, type }) {
  const c = type === "error" ? "#F87171" : "#86EFAC";
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#FFFFFF", border: `1.5px solid ${c}`, borderRadius: 12, padding: "11px 22px", color: c, fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap", fontFamily: T.font, boxShadow: "0 4px 20px rgba(15,23,42,0.12)" }}>
      {msg}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12px 8px", overflowY: "auto", fontFamily: T.font, WebkitOverflowScrolling: "touch" }}>
      <div style={{ background: "#FFFFFF", border: `1.5px solid ${T.bd}`, borderRadius: 14, boxShadow: "0 20px 60px rgba(15,23,42,0.12)", width: "100%", maxWidth: wide ? 720 : 520, marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${T.bd}` }}>
          <span style={{ fontWeight: 700, color: T.tx, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, fontSize: 22, cursor: "pointer", fontFamily: T.font }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Fld({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.dim, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Ring({ pct, color, size = 48 }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color || "#60A5FA"} strokeWidth={4} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+4} textAnchor="middle" fill={T.tx} fontSize={10} fontFamily={T.font}>{pct}%</text>
    </svg>
  );
}

function Av({ id, users, size = 28 }) {
  const u = (users || []).find((x) => x.id === id);
  if (!u) return null;
  const mc = getMC(id, users);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: mc, color: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {u.name[0]}
    </div>
  );
}

/* ── login ── */
function LoginPage() {
  const { users, login } = useApp();
  const roleOrder = { admin: 0, manager: 1, submanager: 2, staff: 3 };
  const sorted = [...users].filter(u => u.is_active).sort((a, b) => (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9));

  const ROLE_STYLES = {
    admin:      { bg: "#001B60", color: "#FFFFFF", badge: "#B91C1C", badgeTx: "#FFFFFF" },
    manager:    { bg: "#EEF2FF", color: "#001B60", badge: "#001B60", badgeTx: "#FFFFFF" },
    submanager: { bg: "#F0FDF4", color: "#166534", badge: "#16A34A", badgeTx: "#FFFFFF" },
    staff:      { bg: "#FFFFFF",  color: "#374151", badge: "#E5E7EB", badgeTx: "#6B7280" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #F8FAFF 0%, #EEF2FF 50%, #FEF2F2 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* ── ヘッダー ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 4px 24px rgba(0,27,96,0.12)", marginBottom: 16 }}>
            <img src={LOGO_B64} alt="DANCE GRAND" style={{ width: 68, height: 68, objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#001B60", letterSpacing: "0.10em", lineHeight: 1.1 }}>DANCE GRAND</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 }}>
            <div style={{ height: 1, width: 40, background: "linear-gradient(to right, transparent, #B91C1C)" }} />
            <span style={{ fontSize: 10, color: "#B91C1C", letterSpacing: "0.16em", fontWeight: 700 }}>簡単タスク管理</span>
            <div style={{ height: 1, width: 40, background: "linear-gradient(to left, transparent, #B91C1C)" }} />
          </div>
        </div>

        {/* ── 役割グループ ── */}
        {["admin","manager","submanager","staff"].map(role => {
          const group = sorted.filter(u => u.role === role && u.is_active);
          if (!group.length) return null;
          const st = ROLE_STYLES[role];
          return (
            <div key={role} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.12em", marginBottom: 6, paddingLeft: 4 }}>
                {ROLES[role].toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.map(u => (
                  <button key={u.id} onClick={() => login(u)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, border: "none", background: st.bg, cursor: "pointer", fontFamily: T.font, textAlign: "left", boxShadow: role === "admin" ? "0 4px 16px rgba(0,27,96,0.18)" : "0 1px 4px rgba(0,0,0,0.06)", transition: "transform 0.1s" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: role === "admin" ? "rgba(255,255,255,0.15)" : getMC(u.id, users) + "30", border: role === "admin" ? "1.5px solid rgba(255,255,255,0.3)" : `1.5px solid ${getMC(u.id, users)}50`, color: role === "admin" ? "#FFFFFF" : getMC(u.id, users), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, flexShrink: 0 }}>
                      {u.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, color: st.color, fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: role === "admin" ? "rgba(255,255,255,0.6)" : "#9CA3AF", marginTop: 1 }}>{u.team}</div>
                    </div>
                    <div style={{ fontSize: 18, color: role === "admin" ? "rgba(255,255,255,0.5)" : "#D1D5DB" }}>›</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", fontSize: 10, color: "#9CA3AF", marginTop: 20, letterSpacing: "0.05em" }}>
          名前をタップしてください
        </div>
      </div>
    </div>
  );
}

/* ── task card ── */
function TaskCard({ task, onClick }) {
  const st = STATS.find((s) => s.id === task.status) || STATS[0];
  const pri = PRIS.find((p) => p.id === task.priority) || PRIS[1];
  const ovd = isOvd(task);
  const { setTasks, showToast, log, users } = useApp();
  const cycle = (e) => {
    e.stopPropagation();
    const ns = STATS.find((s) => s.id === st.next);
    setTasks((p) => p.map((t) => t.id !== task.id ? t : { ...t, status: ns.id, completed_at: ns.id === "done" ? new Date().toISOString() : t.completed_at }));
    log("task_status", `「${task.title}」→ ${ns.label}`);
    showToast(ns.id === "done" ? "✅ 完了！" : "📝 更新");
  };
  return (
    <div onClick={() => onClick(task)} style={{ background: "#FFFFFF", borderRadius: 10, padding: "10px 13px", marginBottom: 6, cursor: "pointer", borderLeft: `3px solid ${ovd ? "#F87171" : st.color}`, boxShadow: "0 1px 4px rgba(15,23,42,0.06)", outline: `1px solid ${T.bd2}`, opacity: task.status === "done" ? 0.5 : 1 }}>
      <div style={{ fontSize: 13, color: task.status === "done" ? T.dim : T.tx, fontWeight: 500, marginBottom: 4, textDecoration: task.status === "done" ? "line-through" : "none", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{task.title}</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={cycle} style={bSm(st.color)}>{st.icon} {st.label}</button>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: pri.color + "18", color: pri.color }}>{pri.label}</span>
        {task.work_date && task.work_date !== TD && <span style={{ fontSize: 10, color: T.dimmer }}>📆{fmt(task.work_date)}</span>}
        {ovd && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700, background: "#FEF2F2", padding: "1px 6px", borderRadius: 4 }}>⚠ 期限超過</span>}
        {task.due_at && !ovd && <span style={{ fontSize: 10, color: T.dim }}>⏰{fmtDT(task.due_at)}</span>}
        {(task.tags || []).slice(0, 1).map((tg) => <span key={tg} style={{ fontSize: 10, color: T.dimmer }}>#{tg}</span>)}
        <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          {(task.assignees || []).map(aid => {
            const au = users.find(u => u.id === aid);
            if (!au) return null;
            const mc = getMC(aid, users);
            return <div key={aid} title={au.name} style={{ width: 20, height: 20, borderRadius: "50%", background: mc, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{au.name[0]}</div>;
          })}
        </div>
      </div>
    </div>
  );
}



/* ── プール用テンプレ選択 ── */
function PoolFromTpl({ onSelect, onClose }) {
  const [tpls, setTpls] = useState(ITPL);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const CC = { "SNS・広報":"#60A5FA","生徒対応":"#86EFAC","タスク管理":"#0F172A","施設・備品":"#FDBA74","研修・育成":"#C4B5FD","イベント":"#F87171" };

  useEffect(() => { dbGet(SK.tpl, ITPL).then(setTpls); }, []);

  const cats = ["all", ...new Set(tpls.map(t => t.cat))];
  const fl = tpls.filter(t =>
    (cat === "all" || t.cat === cat) &&
    (!q || t.title.includes(q) || (t.tags||[]).some(tg => tg.includes(q)))
  );

  const handleSelect = (tp) => {
    // テンプレからプールアイテムの初期値を生成
    onSelect({
      id: uid(),
      title: tp.title,
      category: "project",
      status: "todo",
      priority: tp.priority || "mid",
      description: tp.memo || "",
      assignees: [],
      tags: tp.tags || [],
      steps: [],
      due_at: "",
      created_by: "",
      created_at: new Date().toISOString(),
      _fromTpl: true,
    });
  };

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:1200, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"12px 8px", overflowY:"auto", fontFamily:T.font }}>
      <div style={{ width:"100%", maxWidth:520, background:"#FFFFFF", border:`1px solid ${T.bd}`, borderRadius:16, marginTop:24, marginBottom:24, boxShadow:"0 20px 60px rgba(15,23,42,0.14)" }}>
        <div style={{ padding:"13px 18px", borderBottom:`1px solid ${T.bd}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:T.navy }}>🏊 テンプレからプールに追加</div>
            <div style={{ fontSize:11, color:T.dim, marginTop:1 }}>選択するとプール詳細画面が開きます</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.dim, fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:"10px 18px", borderBottom:`1px solid ${T.bd}`, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 検索..." style={{...IS, maxWidth:160, padding:"6px 10px", fontSize:12}} autoFocus />
          {cats.map(c => {
            const cc = c==="all" ? T.navy : (CC[c]||T.navy);
            return <button key={c} onClick={()=>setCat(c)} style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontFamily:T.font, border:`1.5px solid ${cat===c?cc:T.bd}`, background:cat===c?cc+"18":"#fff", color:cat===c?cc:T.dim, cursor:"pointer" }}>{c==="all"?"すべて":c}</button>;
          })}
        </div>

        <div style={{ padding:"10px 18px 18px", maxHeight:400, overflowY:"auto" }}>
          {cats.filter(c=>c!=="all").map(c => {
            const items = fl.filter(t => t.cat === c);
            if (!items.length) return null;
            const cc = CC[c] || T.navy;
            return (
              <div key={c} style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:cc, marginBottom:5, paddingBottom:3, borderBottom:`1px solid ${cc}22` }}>{c}</div>
                {items.map(tp => {
                  const pri = PRIS.find(p=>p.id===tp.priority)||PRIS[1];
                  return (
                    <button key={tp.id} onClick={()=>handleSelect(tp)} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:8, border:`1px solid ${T.bd}`, background:"#FAFAFA", cursor:"pointer", fontFamily:T.font, textAlign:"left", width:"100%", marginBottom:4 }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{tp.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:T.tx, fontWeight:500 }}>{tp.title}</div>
                        <div style={{ display:"flex", gap:3, marginTop:2 }}>
                          {(tp.tags||[]).map(tg=><span key={tg} style={{ fontSize:10, padding:"1px 5px", borderRadius:3, background:cc+"15", color:cc }}>#{tg}</span>)}
                          <span style={{ fontSize:10, padding:"1px 5px", borderRadius:3, background:pri.color+"15", color:pri.color }}>{pri.label}</span>
                        </div>
                      </div>
                      <span style={{ fontSize:20, color:T.dim }}>›</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {fl.length === 0 && <div style={{ textAlign:"center", padding:"30px 0", color:T.dim }}>該当なし</div>}
        </div>
      </div>
    </div>
  );
}

/* ── 一括スマートタスク追加 ── */
function BulkAdd({ onClose }) {
  const { users, setTasks, currentUser, showToast, log } = useApp();
  const [tpls, setTpls] = useState(ITPL);
  const [selected, setSelected] = useState({}); // id -> true
  const [date, setDate] = useState(TD);
  const [assignee, setAssignee] = useState(currentUser.id);
  const [priority, setPriority] = useState("mid");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const CC = { "SNS・広報":"#60A5FA","生徒対応":"#86EFAC","タスク管理":"#0F172A","施設・備品":"#FDBA74","研修・育成":"#C4B5FD","イベント":"#F87171" };

  useEffect(() => { dbGet(SK.tpl, ITPL).then(setTpls); }, []);

  const cats = ["all", ...new Set(tpls.map(t => t.cat))];
  const fl = tpls.filter(t =>
    (cat === "all" || t.cat === cat) &&
    (!q || t.title.includes(q) || (t.tags||[]).some(tg => tg.includes(q)))
  );
  const selCount = Object.values(selected).filter(Boolean).length;
  const toggleAll = () => {
    if (selCount === fl.length) setSelected({});
    else setSelected(Object.fromEntries(fl.map(t => [t.id, true])));
  };

  const addAll = () => {
    const toAdd = tpls.filter(t => selected[t.id]);
    if (!toAdd.length) { showToast("テンプレートを選択してください", "error"); return; }
    const now = new Date().toISOString();
    const newTasks = toAdd.map(tp => ({
      id: uid(),
      title: tp.title,
      description: "",
      status: "todo",
      assignees: assignee ? [assignee] : [],
      priority: priority !== "inherit" ? priority : (tp.priority || "mid"),
      work_date: date,
      due_at: "",
      tags: tp.tags || [],
      memo: tp.memo || "",
      attachments: [],
      created_by: currentUser.id,
      created_at: now,
    }));
    setTasks(p => [...p, ...newTasks]);
    log("task_add", `一括追加：${newTasks.length}件（${newTasks.map(t=>t.title).slice(0,2).join("・")}${newTasks.length>2?"ほか":""}）`);
    showToast(`✅ ${newTasks.length}件のタスクを追加しました`);
    onClose();
  };

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:1100, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"12px 8px", overflowY:"auto", fontFamily:T.font }}>
      <div style={{ width:"100%", maxWidth:600, background:"#FFFFFF", border:`1px solid ${T.bd}`, borderRadius:16, marginTop:20, marginBottom:20, boxShadow:"0 20px 60px rgba(15,23,42,0.14)" }}>

        {/* ヘッダー */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.bd}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.navy }}>⚡ 一括タスク追加</div>
            <div style={{ fontSize:11, color:T.dim, marginTop:1 }}>テンプレートを複数選んでまとめて登録</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.dim, fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        {/* 共通設定 */}
        <div style={{ padding:"14px 20px", background:"#F8FAFF", borderBottom:`1px solid ${T.bd}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.dim, marginBottom:8, letterSpacing:"0.08em" }}>共通設定（選択したタスク全てに適用）</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            <Fld label="📅 作業日">
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...IS, fontSize:13}} />
            </Fld>
            <Fld label="👤 担当者">
              <select value={assignee} onChange={e=>setAssignee(e.target.value)} style={{...IS, fontSize:13, padding:"8px"}}>
                <option value="">未設定</option>
                {users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Fld>
            <Fld label="🏷 優先度">
              <select value={priority} onChange={e=>setPriority(e.target.value)} style={{...IS, fontSize:13, padding:"8px"}}>
                <option value="inherit">テンプレ準拠</option>
                {PRIS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Fld>
          </div>
        </div>

        {/* フィルター */}
        <div style={{ padding:"10px 20px", borderBottom:`1px solid ${T.bd}`, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 テンプレ検索..." style={{...IS, maxWidth:160, padding:"6px 10px", fontSize:12}} />
          {cats.map(c => {
            const cc = c==="all" ? T.navy : (CC[c]||T.navy);
            return <button key={c} onClick={()=>setCat(c)} style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontFamily:T.font, border:`1.5px solid ${cat===c?cc:T.bd}`, background:cat===c?cc+"18":"#fff", color:cat===c?cc:T.dim, cursor:"pointer" }}>{c==="all"?"すべて":c}</button>;
          })}
        </div>

        {/* テンプレ一覧（チェックボックス） */}
        <div style={{ padding:"10px 20px", maxHeight:320, overflowY:"auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, color:T.dim }}>{fl.length}件</span>
            <button onClick={toggleAll} style={{ fontSize:11, color:T.navy, background:"none", border:"none", cursor:"pointer", fontFamily:T.font, fontWeight:600 }}>
              {selCount===fl.length?"すべて解除":"すべて選択"}
            </button>
          </div>
          {fl.map(tp => {
            const sel = !!selected[tp.id];
            const cc = CC[tp.cat] || T.navy;
            const pri = PRIS.find(p=>p.id===tp.priority)||PRIS[1];
            return (
              <div key={tp.id} onClick={()=>setSelected(s=>({...s,[tp.id]:!s[tp.id]}))} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, border:`1.5px solid ${sel?"#001B60":T.bd}`, background:sel?"#EEF2FF":"#FAFAFA", cursor:"pointer", marginBottom:4, transition:"all 0.1s" }}>
                <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${sel?"#001B60":T.bd}`, background:sel?"#001B60":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {sel && <span style={{color:"#fff", fontSize:12, fontWeight:900}}>✓</span>}
                </div>
                <span style={{ fontSize:17, flexShrink:0 }}>{tp.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:sel?T.navy:T.tx, fontWeight:sel?700:400 }}>{tp.title}</div>
                  <div style={{ display:"flex", gap:3, marginTop:2 }}>
                    <span style={{ fontSize:10, padding:"1px 5px", borderRadius:3, background:cc+"15", color:cc }}>{tp.cat}</span>
                    <span style={{ fontSize:10, padding:"1px 5px", borderRadius:3, background:pri.color+"15", color:pri.color }}>{pri.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {fl.length===0 && <div style={{textAlign:"center",padding:"30px 0",color:T.dim}}>該当なし</div>}
        </div>

        {/* フッター */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.bd}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:"#F8FAFF", borderRadius:"0 0 16px 16px" }}>
          <div style={{ fontSize:13, color:T.dim }}>
            {selCount > 0
              ? <span style={{color:T.navy,fontWeight:700}}>{selCount}件を選択中</span>
              : "テンプレートをタップして選択"}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} style={bO(T.dim)}>キャンセル</button>
            <button onClick={addAll} style={{ ...bP, opacity:selCount===0?0.4:1 }}>
              {selCount>0 ? `⚡ ${selCount}件を一括追加` : "一括追加"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── template picker ── */
function TplPicker({ onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tpls, setTpls] = useState(ITPL);
  const CC = { "SNS・広報": "#60A5FA", "生徒対応": "#86EFAC", "タスク管理": "#FFFFFF", "施設・備品": "#FDBA74", "研修・育成": "#C4B5FD", "イベント": "#FCA5A5" };
  useEffect(() => { dbGet(SK.tpl, ITPL).then(setTpls); }, []);
  const cats = ["all", ...new Set(tpls.map((t) => t.cat))];
  const fl = tpls.filter((t) => (cat === "all" || t.cat === cat) && (!q || t.title.includes(q) || (t.tags || []).some((tg) => tg.includes(q))));
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px 12px", overflowY: "auto", fontFamily: T.font }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#FFFFFF", border: `1.5px solid ${T.bd}`, borderRadius: 14, boxShadow: "0 20px 60px rgba(15,23,42,0.12)", marginTop: 24, marginBottom: 24 }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.tx }}>⚡ よく使うタスクから選ぶ</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>タップで自動入力</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, fontSize: 20, cursor: "pointer", fontFamily: T.font }}>✕</button>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${T.bd}`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 検索..." style={{ ...IS, maxWidth: 170, padding: "6px 10px", fontSize: 12 }} autoFocus />
          {cats.map((c) => {
            const cc = c === "all" ? T.tx : (CC[c] || T.tx);
            return (
              <button key={c} onClick={() => setCat(c)} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontFamily: T.font, border: `1.5px solid ${cat === c ? cc : T.bd}`, background: cat === c ? cc + "22" : "transparent", color: cat === c ? cc : T.dim, cursor: "pointer" }}>
                {c === "all" ? "すべて" : c}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "10px 18px 18px", maxHeight: 380, overflowY: "auto" }}>
          {cats.filter((c) => c !== "all").map((c) => {
            const items = fl.filter((t) => t.cat === c);
            if (!items.length) return null;
            const cc = CC[c] || T.tx;
            return (
              <div key={c} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: cc, marginBottom: 4, paddingBottom: 4, borderBottom: `1px solid ${cc}22` }}>{c}</div>
                {items.map((tp) => {
                  const pri = PRIS.find((p) => p.id === tp.priority) || PRIS[1];
                  return (
                    <button key={tp.id} onClick={() => onSelect(tp)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.bd}`, background: "#F8FAFF", cursor: "pointer", fontFamily: T.font, textAlign: "left", width: "100%", marginBottom: 3 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{tp.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: T.tx, fontWeight: 500 }}>{tp.title}</div>
                        <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                          {(tp.tags || []).map((tg) => <span key={tg} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: cc + "18", color: cc }}>#{tg}</span>)}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: pri.color + "20", color: pri.color, flexShrink: 0 }}>{pri.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {fl.length === 0 && <div style={{ textAlign: "center", padding: "28px 0", color: T.dim, fontSize: 13 }}>該当なし</div>}
        </div>
      </div>
    </div>
  );
}

/* ── task modal ── */
function TaskModal({ task: init, defaultDate, defaultAssignee, onClose, readOnly = false }) {
  const { users, setTasks, currentUser, isAdmin, isFullAdmin, showToast, log } = useApp();
  const isNew = !init;
  const blank = { title: "", description: "", status: "todo", assignees: defaultAssignee ? [defaultAssignee] : (currentUser ? [currentUser.id] : []), priority: "mid", work_date: defaultDate || TD, due_at: "", tags: [], memo: "", attachments: [] };
  const [form, setForm] = useState(init ? { ...init } : blank);
  const [editing, setEditing] = useState(isNew && !readOnly);
  const [tagIn, setTagIn] = useState("");
  const [delConf, setDelConf] = useState(false);
  const [showTpl, setShowTpl] = useState(isNew && !readOnly);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const apply = (tp) => {
    setForm((f) => ({
      ...f,
      title: tp.title,
      priority: tp.priority || f.priority,
      tags: [...new Set([...(f.tags || []), ...(tp.tags || [])])],
      memo: tp.memo ? (!f.memo ? tp.memo : f.memo + "\n\n【テンプレ追記】\n" + tp.memo) : f.memo,
    }));
    setShowTpl(false);
  };

  const save = () => {
    if (!form.title.trim()) { showToast("タスク名を入力してください", "error"); return; }
    if (isNew) {
      const newTask = { ...form, id: uid(), created_by: currentUser.id, created_at: new Date().toISOString() };
      setTasks((p) => [...p, newTask]);
      log("task_add", `「${form.title}」を追加`);
      showToast("✅ タスクを追加しました");
    } else {
      setTasks((p) => p.map((t) => t.id !== init.id ? t : { ...t, ...form, completed_at: form.status === "done" && t.status !== "done" ? new Date().toISOString() : t.completed_at }));
      log("task_update", `「${form.title}」を編集`);
      showToast("✅ 更新しました");
    }
    onClose();
  };

  const del = () => { log("task_delete", `「${init.title}」を削除`); setTasks((p) => p.filter((t) => t.id !== init.id)); showToast("🗑 削除しました"); onClose(); };
  const addTag = (s) => {
    const tag = (s || tagIn).trim().replace(/^#/, "");
    if (tag && !(form.tags || []).includes(tag)) upd("tags", [...(form.tags || []), tag]);
    if (!s) setTagIn("");
  };
  const ass = users.find((u) => u.id === (form.assignees || [])[0]);
  const canEdit = !readOnly && (
    isNew ||
    isAdmin ||
    init?.created_by === currentUser.id ||
    (init?.assignees || []).includes(currentUser.id)
  );
  // スタッフは自分が作成・担当するタスクのみ編集可
  const canDelete = isAdmin || init?.created_by === currentUser.id;

  return (
    <>
      <Modal title={isNew ? "タスクを追加" : editing ? "タスクを編集" : "タスク詳細"} onClose={onClose} wide>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {STATS.map((s) => (
            <button key={s.id} onClick={() => canEdit && upd("status", s.id)} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, fontFamily: T.font, border: `1.5px solid ${form.status === s.id ? s.color : T.bd}`, background: form.status === s.id ? s.color + "18" : "#FAFAFA", color: form.status === s.id ? s.color : T.dim, fontWeight: form.status === s.id ? 700 : 400, fontSize: 13, cursor: canEdit ? "pointer" : "default" }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        {editing ? (
          <>
            {isNew && (
              <button onClick={() => setShowTpl(true)} style={{ width: "100%", padding: "9px", borderRadius: 8, border: `1.5px dashed ${T.bd}`, background: "#FFFFFF06", color: T.dim, cursor: "pointer", fontFamily: T.font, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                <span>⚡ よく使うタスクから選ぶ</span>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "#B91C1C22", color: "#F87171" }}>ショートカット</span>
              </button>
            )}
            <Fld label="タスク名 *">
              <input value={form.title} onChange={(e) => upd("title", e.target.value)} style={IS} placeholder="タスク名を入力..." autoFocus={!isNew} />
            </Fld>
            <Fld label="説明">
              <textarea value={form.description || ""} onChange={(e) => upd("description", e.target.value)} rows={2} style={{ ...IS, resize: "vertical" }} placeholder="詳細・注意事項..." />
            </Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Fld label="担当者">
                <select value={(form.assignees || [])[0] || ""} onChange={(e) => upd("assignees", e.target.value ? [e.target.value] : [])} style={{ ...IS, padding: "9px 8px" }}>
                  <option value="">未設定</option>
                  {users.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Fld>
              <Fld label="優先度">
                <select value={form.priority} onChange={(e) => upd("priority", e.target.value)} style={{ ...IS, padding: "9px 8px" }}>
                  {PRIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Fld>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Fld label="📅 作業予定日">
                <input type="date" value={form.work_date || ""} onChange={(e) => upd("work_date", e.target.value)} style={IS} />
              </Fld>
              <Fld label="⏰ 期限日時">
                <input type="datetime-local" value={form.due_at || ""} onChange={(e) => upd("due_at", e.target.value)} style={IS} />
              </Fld>
            </div>
            <Fld label="タグ">
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                {(form.tags || []).map((tg) => <span key={tg} onClick={() => upd("tags", (form.tags || []).filter((x) => x !== tg))} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 8, background: "#EEF2FF", color: "#475569", cursor: "pointer" }}>{tg} ✕</span>)}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="タグ（Enterで追加）" style={{ ...IS, flex: 1 }} />
                <button onClick={() => addTag()} style={bO(T.tx)}>追加</button>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                {TPRE.filter((t) => !(form.tags || []).includes(t)).map((t) => <span key={t} onClick={() => addTag(t)} style={{ fontSize: 11, color: T.dim, cursor: "pointer", padding: "2px 6px", border: `1px dashed ${T.bd}`, borderRadius: 6, background: "#FAFAFA" }}>＋{t}</span>)}
              </div>
            </Fld>
            <Fld label="メモ">
              <textarea value={form.memo || ""} onChange={(e) => upd("memo", e.target.value)} rows={2} style={{ ...IS, resize: "vertical" }} />
            </Fld>
            {delConf && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px", marginBottom: 8 }}>
                <div style={{ color: "#F87171", fontSize: 13, marginBottom: 8 }}>本当に削除しますか？</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={del} style={{ ...bO("#F87171"), flex: 1 }}>削除する</button>
                  <button onClick={() => setDelConf(false)} style={{ ...bO(T.dim), flex: 1 }}>キャンセル</button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap:"wrap", gap:8 }}>
              <div style={{display:"flex", gap:6}}>
                {!isNew && canDelete && !delConf && <button onClick={() => setDelConf(true)} style={{ ...bO("#F87171"), fontSize: 12, padding: "6px 12px" }}>削除</button>}
                {form.title && <button onClick={() => {
                  const newTpl = { id:uid(), title:form.title, cat:"タスク管理", icon:"✅", priority:form.priority||"mid", tags:form.tags||[], memo:form.memo||"" };
                  dbGet(SK.tpl, ITPL).then(tpls => dbSet(SK.tpl, [...tpls, newTpl]));
                  showToast("📋 テンプレートに登録しました");
                }} style={{ ...bO(T.navy), fontSize:12, padding:"6px 12px" }}>📋 テンプレ登録</button>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} style={bO(T.dim)}>キャンセル</button>
                <button onClick={save} style={bP}>{isNew ? "追加" : "保存"}</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: T.tx, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{form.title}</h2>
            {form.description && <p style={{ color: T.dim, fontSize: 13, lineHeight: 1.7, marginBottom: 12, whiteSpace: "pre-wrap" }}>{form.description}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                ["担当者", ass ? <span style={{ color: getMC(ass.id, users), fontWeight: 700 }}>{ass.name}</span> : "未設定"],
                ["優先度", <span style={{ color: PRIS.find((p) => p.id === form.priority)?.color, fontWeight: 700 }}>{PRIS.find((p) => p.id === form.priority)?.label}</span>],
                ["作業予定日", form.work_date || "未設定"],
                ["期限", fmtDT(form.due_at)],
              ].map(([l, v], i) => (
                <div key={i} style={{ background: "#F8FAFF", borderRadius: 8, padding: "9px 12px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 10, color: T.dim, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13, color: T.tx }}>{v}</div>
                </div>
              ))}
            </div>
            {(form.tags || []).length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                {(form.tags || []).map((tg) => <span key={tg} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 8, background: "#EEF2FF", color: "#475569" }}>#{tg}</span>)}
              </div>
            )}
            {!isNew && (
              <div style={{ fontSize: 11, color: T.dimmer, marginBottom: 10, display: "flex", gap: 12 }}>
                {init?.created_by && (() => { const cr = users.find(u => u.id === init.created_by); return cr ? <span>作成：{cr.name}</span> : null; })()}
                {init?.created_at && <span>{new Date(init.created_at).toLocaleDateString("ja", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}</span>}
                {init?.completed_at && <span style={{color:"#16A34A"}}>✅ {new Date(init.completed_at).toLocaleDateString("ja", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}完了</span>}
              </div>
            )}
            {form.memo && (
              <div style={{ background: "#F8FAFF", borderRadius: 8, padding: "10px 12px", marginBottom: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 10, color: T.dim, marginBottom: 4 }}>メモ</div>
                <div style={{ fontSize: 13, color: T.tx, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{form.memo}</div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {canEdit && <button style={bP} onClick={() => setEditing(true)}>編集する</button>}
            </div>
          </>
        )}
      </Modal>
      {showTpl && <TplPicker onSelect={apply} onClose={() => setShowTpl(false)} />}
    </>
  );
}

/* ── pool ── */
function PoolCard({ item, onClick }) {
  const cat = PCATS.find((c) => c.id === item.category) || PCATS[0];
  const pri = PRIS.find((p) => p.id === item.priority) || PRIS[1];
  const dn = (item.steps || []).filter((s) => s.done).length;
  const tot = (item.steps || []).length;
  const pct = tot ? Math.round(dn / tot * 100) : 0;
  return (
    <div onClick={() => onClick(item)} style={{ background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 12, padding: "13px 16px", cursor: "pointer", marginBottom: 8, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: T.tx, fontWeight: 600, marginBottom: 3 }}>{item.title}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: cat.color + "20", color: cat.color }}>{cat.label}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: pri.color + "18", color: pri.color }}>{pri.label}</span>
          </div>
        </div>
        {tot > 0 && <Ring pct={pct} color={cat.color} size={44} />}
      </div>
      {item.due_at && <div style={{ fontSize: 11, color: T.dim }}>📅 {fmt(item.due_at)}</div>}
    </div>
  );
}

function PoolModal({ item: init, onClose }) {
  const { pool, setPool, users, showToast, log, currentUser } = useApp();
  const [item, setItem] = useState({ ...init });
  const upd = (k, v) => setItem((i) => ({ ...i, [k]: v }));
  const [tagIn, setTagIn] = useState("");
  const [ns, setNs] = useState("");
  const isNewPool = !pool.some(x => x.id === init.id);
  const save = () => {
    if (!item.title.trim()) { showToast("タイトルを入力してください", "error"); return; }
    if (isNewPool) {
      setPool(p => [...p, { ...item, created_by: item.created_by, created_at: item.created_at }]);
      log("pool_update", `「${item.title}」をプールに追加`);
      showToast("✅ プールに追加しました");
    } else {
      setPool(p => p.map(x => x.id === init.id ? item : x));
      log("pool_update", `「${item.title}」を更新`);
      showToast("✅ 更新しました");
    }
    onClose();
  };
  const toggleStep = (sid) => upd("steps", (item.steps || []).map((s) => s.id === sid ? { ...s, done: !s.done } : s));
  const addStep = () => { if (!ns.trim()) return; upd("steps", [...(item.steps || []), { id: uid(), title: ns.trim(), done: false }]); setNs(""); };
  const addTag = (s) => { const t = (s || tagIn).trim().replace(/^#/, ""); if (t && !(item.tags || []).includes(t)) upd("tags", [...(item.tags || []), t]); if (!s) setTagIn(""); };
  const dn = (item.steps || []).filter((s) => s.done).length;
  const tot = (item.steps || []).length;
  const pct = tot ? Math.round(dn / tot * 100) : 0;
  return (
    <Modal title="タスクプール詳細" onClose={onClose} wide>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{PCATS.find((c) => c.id === item.category)?.icon || "🏗"}</span>
        <input value={item.title} onChange={(e) => upd("title", e.target.value)} style={{ ...IS, fontSize: 16, fontWeight: 700 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Fld label="カテゴリ">
          <select value={item.category} onChange={(e) => upd("category", e.target.value)} style={{ ...IS, padding: "8px" }}>
            {PCATS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </Fld>
        <Fld label="優先度">
          <select value={item.priority} onChange={(e) => upd("priority", e.target.value)} style={{ ...IS, padding: "8px" }}>
            {PRIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Fld>
        <Fld label="期限">
          <input type="date" value={(item.due_at || "").slice(0, 10)} onChange={(e) => upd("due_at", e.target.value)} style={IS} />
        </Fld>
      </div>
      <Fld label="説明">
        <textarea value={item.description || ""} onChange={(e) => upd("description", e.target.value)} rows={2} style={{ ...IS, resize: "vertical" }} />
      </Fld>
      <Fld label={`ステップ（${dn}/${tot} ${pct}%）`}>
        {(item.steps || []).map((s) => (
          <div key={s.id} onClick={() => toggleStep(s.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, background: "#F8FAFF", marginBottom: 3, cursor: "pointer" }}>
            <span style={{ color: s.done ? "#86EFAC" : "#4A6AA0", fontSize: 16 }}>{s.done ? "✅" : "○"}</span>
            <span style={{ fontSize: 13, color: s.done ? T.dim : T.tx, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
          <input value={ns} onChange={(e) => setNs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep())} placeholder="ステップを追加..." style={{ ...IS, flex: 1 }} />
          <button onClick={addStep} style={bO(T.tx)}>追加</button>
        </div>
      </Fld>
      <Fld label="担当者">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {users.filter((u) => u.is_active).map((u) => {
            const sel = (item.assignees || []).includes(u.id);
            const mc = getMC(u.id, users);
            return (
              <button key={u.id} onClick={() => upd("assignees", sel ? (item.assignees || []).filter((x) => x !== u.id) : [...(item.assignees || []), u.id])} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${sel ? mc : T.bd}`, background: sel ? mc + "22" : "transparent", color: sel ? mc : T.dim, fontSize: 12, cursor: "pointer", fontFamily: T.font }}>
                <Av id={u.id} users={users} size={18} />{u.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </Fld>
      <Fld label="タグ">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
          {(item.tags || []).map((tg) => <span key={tg} onClick={() => upd("tags", (item.tags || []).filter((x) => x !== tg))} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 8, background: "#EEF2FF", color: "#475569", cursor: "pointer" }}>{tg} ✕</span>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="タグ" style={{ ...IS, flex: 1 }} />
          <button onClick={() => addTag()} style={bO(T.tx)}>追加</button>
        </div>
      </Fld>
      {!isNewPool && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.bd}` }}>
          <button onClick={() => {
            if (window.confirm(`「${item.title}」をプールから削除しますか？`)) {
              setPool(p => p.filter(x => x.id !== init.id));
              log("pool_update", `「${item.title}」をプールから削除`);
              showToast("🗑 削除しました");
              onClose();
            }
          }} style={{ ...bO("#EF4444"), fontSize: 12, padding: "5px 12px" }}>🗑 プールから削除</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button onClick={onClose} style={bO(T.dim)}>キャンセル</button>
        <button onClick={save} style={bP}>{isNewPool ? "追加" : "保存"}</button>
      </div>
    </Modal>
  );
}

/* ── views ── */
function DailyView({ isAdm }) {
  const { tasks, currentUser } = useApp();
  const [sel, setSel] = useState(null);
  const [crt, setCrt] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const my = isAdm ? tasks.filter((t) => t.work_date === TD) : tasks.filter((t) => t.work_date === TD && (t.assignees || []).includes(currentUser.id));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: T.dim }}>
          今日のタスク {my.length}件
          {my.length > 0 && (
            <span style={{ marginLeft: 10, fontSize: 11 }}>
              <span style={{ color: "#86EFAC", marginRight: 5 }}>●完了 {my.filter(t=>t.status==="done").length}</span>
              <span style={{ color: "#60A5FA", marginRight: 5 }}>◑着手 {my.filter(t=>t.status==="doing").length}</span>
              <span style={{ color: T.dimmer }}>○未着手 {my.filter(t=>t.status==="todo").length}</span>
            </span>
          )}
        </div>
        {isAdm && <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setBulk(true)} style={{...bP, background:"linear-gradient(135deg,#1E3A8A,#001B60)"}}>⚡ 一括</button>
          <button onClick={() => setCrt(true)} style={bP}>＋ 追加</button>
        </div>}
      </div>
      {/* 未完了を優先表示 */}
      {STATS.filter(s => s.id !== "done").map((s) => {
        const items = my.filter((t) => t.status === s.id);
        return items.length ? (
          <div key={s.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 700, marginBottom: 5 }}>
              {s.icon} {s.label} <span style={{ fontSize: 10, background: s.color + "18", padding: "1px 7px", borderRadius: 8 }}>{items.length}</span>
            </div>
            {items.map((t) => <TaskCard key={t.id} task={t} onClick={setSel} />)}
          </div>
        ) : null;
      })}
      {/* 完了タスクは折りたたみ */}
      {(() => {
        const doneItems = my.filter(t => t.status === "done");
        if (!doneItems.length) return null;
        return (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setShowDone(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.dim, fontSize: 12, fontFamily: T.font, padding: "4px 0", marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{showDone ? "▾" : "▸"}</span>
              完了済み <span style={{ fontSize: 10, background: "#86EFAC18", color: "#16A34A", padding: "1px 7px", borderRadius: 8 }}>{doneItems.length}</span>
            </button>
            {showDone && doneItems.map((t) => <TaskCard key={t.id} task={t} onClick={setSel} />)}
          </div>
        );
      })()}
      {my.length === 0 && <div style={{ textAlign: "center", padding: "60px 20px", color: T.dim, fontSize: 14 }}><div style={{fontSize:36,marginBottom:12}}>📋</div>今日のタスクはありません<div style={{fontSize:12,color:T.dimmer,marginTop:6}}>右上の「＋ 追加」でタスクを作成できます</div></div>}
      {sel && <TaskModal task={sel} onClose={() => setSel(null)} />}
      {crt && <TaskModal defaultDate={TD} onClose={() => setCrt(false)} />}
      {bulk && <BulkAdd onClose={() => setBulk(false)} />}
    </div>
  );
}

function WeeklyView({ isAdm }) {
  const { tasks, currentUser } = useApp();
  const [sel, setSel] = useState(null);
  const [crtD, setCrtD] = useState(null);
  const [weekOfs, setWeekOfs] = useState(0); // 0=今週, 1=翌週, -1=先週

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    const day = d.getDay();
    const monday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + monday + i + weekOfs * 7);
    return d.toISOString().slice(0, 10);
  });

  const weekLabel = weekOfs === 0 ? "今週" : weekOfs > 0 ? `${weekOfs}週後` : `${Math.abs(weekOfs)}週前`;
  const rangeLabel = `${new Date(days[0]+"T00:00:00").toLocaleDateString("ja",{month:"numeric",day:"numeric"})} 〜 ${new Date(days[6]+"T00:00:00").toLocaleDateString("ja",{month:"numeric",day:"numeric"})}`;

  return (
    <div>
      {/* 週ナビゲーション */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, background:"#FFFFFF", borderRadius:10, padding:"8px 14px", border:`1px solid ${T.bd}`, boxShadow:"0 1px 4px rgba(15,23,42,0.05)" }}>
        <button onClick={() => setWeekOfs(v => v-1)} style={{ ...bO(T.navy), padding:"5px 14px", fontSize:16 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:13, fontWeight:700, color: weekOfs===0 ? T.navy : T.tx }}>{weekLabel}</div>
          <div style={{ fontSize:11, color:T.dim }}>{rangeLabel}</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {weekOfs !== 0 && <button onClick={() => setWeekOfs(0)} style={{ ...bSm(T.navy), padding:"4px 10px" }}>今週</button>}
          <button onClick={() => setWeekOfs(v => v+1)} style={{ ...bO(T.navy), padding:"5px 14px", fontSize:16 }}>›</button>
        </div>
      </div>

      {days.map((d) => {
        const my = isAdm ? tasks.filter((t) => t.work_date === d) : tasks.filter((t) => t.work_date === d && (t.assignees || []).includes(currentUser.id));
        const today = d === TD;
        const isPast = d < TD;
        return (
          <div key={d} style={{ marginBottom: 8, background: "#FFFFFF", borderRadius: 12, border: `1px solid ${today ? "#001B60" : T.bd}`, overflow: "hidden", boxShadow: today ? "0 2px 12px rgba(0,27,96,0.10)" : "0 1px 3px rgba(15,23,42,0.05)", opacity: isPast ? 0.75 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: today ? "#EEF2FF" : isPast ? "#FAFAFA" : "#F8FAFF", borderBottom: my.length ? `1px solid ${T.bd}` : "none" }}>
              <div style={{ fontSize: 13, color: today ? T.navy : (isPast ? T.dimmer : T.tx), fontWeight: today ? 700 : 400 }}>
                {new Date(d + "T00:00:00").toLocaleDateString("ja", { month: "numeric", day: "numeric", weekday: "short" })}
                {today && <span style={{fontSize:10, background:"#001B60", color:"#fff", padding:"1px 6px", borderRadius:4, marginLeft:5}}>今日</span>}
                {isPast && !today && <span style={{fontSize:9, color:T.dimmer, marginLeft:4}}>（過去）</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {my.length > 0 && (() => {
                  const dn = my.filter(t => t.status === "done").length;
                  const pct = Math.round(dn / my.length * 100);
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 60, height: 5, borderRadius: 3, background: "#E2E8F0", overflow: "hidden" }}>
                        <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#16A34A" : "#001B60", borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 10, color: T.dim }}>{dn}/{my.length}</span>
                    </div>
                  );
                })()}
                {isAdm && <button onClick={() => setCrtD(d)} style={{ ...bSm(T.navy), padding: "2px 10px", fontWeight:700 }}>＋</button>}
              </div>
            </div>
            {my.length > 0 && <div style={{ padding: "8px 12px" }}>{my.map((t) => <TaskCard key={t.id} task={t} onClick={setSel} />)}</div>}
          </div>
        );
      })}
      {sel && <TaskModal task={sel} onClose={() => setSel(null)} />}
      {crtD && <TaskModal defaultDate={crtD} onClose={() => setCrtD(null)} />}
    </div>
  );
}

function PoolView({ isAdm }) {
  const { pool, setPool } = useApp();
  const [sel, setSel] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [tplItem, setTplItem] = useState(null);
  const [cat, setCat] = useState("all");
  const fl = cat === "all" ? pool : pool.filter((p) => p.category === cat);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
          {["all", ...PCATS.map((c) => c.id)].map((c) => {
            const pc = PCATS.find((x) => x.id === c);
            const cc = pc ? pc.color : T.tx;
            const act = cat === c;
            return <button key={c} onClick={() => setCat(c)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontFamily: T.font, border: `1.5px solid ${act ? cc : T.bd}`, background: act ? cc + "22" : "transparent", color: act ? cc : T.dim, cursor: "pointer" }}>{pc ? pc.icon + " " + pc.label : "すべて"}</button>;
          })}
        </div>
        {isAdm && <div style={{display:"flex", gap:6}}>
          <button onClick={() => setShowTpl(true)} style={{...bP, background:"linear-gradient(135deg,#1E3A8A,#001B60)", display:"flex", alignItems:"center", gap:5}}>📋 テンプレから</button>
          <button onClick={() => setShowAdd(true)} style={bP}>＋ 手動追加</button>
        </div>}
      </div>
      {fl.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.dim, fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏊</div>
          プールにアイテムがありません
          {isAdm && <div style={{ fontSize: 12, color: T.dimmer, marginTop: 6 }}>「＋ 追加」でプロジェクトや長期課題を登録できます</div>}
        </div>
      )}
      {fl.map((p) => <PoolCard key={p.id} item={p} onClick={setSel} />)}
      {sel && <PoolModal item={sel} onClose={() => setSel(null)} />}
      {showAdd && <PoolModal item={{ id: uid(), title: "", category: "project", status: "todo", priority: "mid", assignees: [], tags: [], steps: [], description: "", due_at: "", created_by: "", created_at: new Date().toISOString() }} onClose={() => setShowAdd(false)} />}
      {showTpl && <PoolFromTpl onSelect={item => { setTplItem(item); setShowTpl(false); }} onClose={() => setShowTpl(false)} />}
      {tplItem && <PoolModal item={tplItem} onClose={() => setTplItem(null)} />}
    </div>
  );
}

function TeamView() {
  const { tasks, users } = useApp();
  const [sel, setSel] = useState(null);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
        {users.filter((u) => u.is_active).map((u) => {
          const ut = tasks.filter((t) => (t.assignees || []).includes(u.id));
          const dn = ut.filter((t) => t.status === "done").length;
          const ovd = ut.filter(isOvd).length;
          const pct = ut.length ? Math.round(dn / ut.length * 100) : 0;
          const mc = getMC(u.id, users);
          return (
            <div key={u.id} style={{ background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: mc, color: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>{u.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: T.tx, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>{u.team} · {ROLES[u.role]}</div>
                </div>
                <Ring pct={pct} color={mc} size={44} />
              </div>
              <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                {STATS.map((s) => { const n = ut.filter((t) => t.status === s.id).length; return n ? <span key={s.id} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: s.color + "18", color: s.color }}>{s.icon}{n}</span> : null; })}
                {ovd > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "#F8717118", color: "#F87171" }}>⚠{ovd}</span>}
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {ut.filter((t) => t.status !== "done").map((t) => (
                  <div key={t.id} onClick={() => setSel(t)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, background: "#F8FAFF", marginBottom: 3, cursor: "pointer" }}>
                    <span style={{ fontSize: 10, color: STATS.find((s) => s.id === t.status)?.color }}>●</span>
                    <span style={{ fontSize: 12, color: isOvd(t) ? "#F87171" : T.tx, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {sel && <TaskModal task={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function AllTasksList() {
  const { tasks, users } = useApp();
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const [ua, setUa] = useState("all");
  const [sortBy, setSortBy] = useState("due");
  const fl = tasks.filter((t) => {
    if (st !== "all" && t.status !== st) return false;
    if (ua !== "all" && !(t.assignees || []).includes(ua)) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "due") {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at) - new Date(b.due_at);
    }
    if (sortBy === "created") return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "pri") {
      const po = { high: 0, mid: 1, low: 2 };
      return (po[a.priority] || 1) - (po[b.priority] || 1);
    }
    return 0;
  });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 タスク検索..." style={{ ...IS, maxWidth: 180, padding: "7px 10px", fontSize: 13 }} />
        <select value={st} onChange={(e) => setSt(e.target.value)} style={{ ...IS, maxWidth: 120, padding: "7px 8px", fontSize: 13 }}>
          <option value="all">全ステータス</option>
          {STATS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={ua} onChange={(e) => setUa(e.target.value)} style={{ ...IS, maxWidth: 130, padding: "7px 8px", fontSize: 13 }}>
          <option value="all">全担当</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: T.dim }}>{fl.length}件</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {[["due","期限順"],["pri","優先度順"],["created","新着順"]].map(([k,l]) => (
            <button key={k} onClick={() => setSortBy(k)} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontFamily: T.font, border: `1px solid ${sortBy===k ? T.navy : T.bd}`, background: sortBy===k ? T.navy : "#fff", color: sortBy===k ? "#fff" : T.dim, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>
      {fl.map((t) => <TaskCard key={t.id} task={t} onClick={setSel} />)}
      {sel && <TaskModal task={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function MemberManager() {
  const { users, setUsers, showToast } = useApp();
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const open = (u) => { setEdit(u || null); setForm(u ? { ...u } : { id: uid(), name: "", role: "staff", team: "", is_active: true }); };
  const save = () => {
    if (!form.name.trim()) { showToast("名前を入力", "error"); return; }
    if (edit?.id) setUsers((p) => p.map((u) => u.id === edit.id ? form : u));
    else setUsers((p) => [...p, form]);
    showToast("✅ 保存しました"); setEdit(null);
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => open(null)} style={bP}>＋ メンバー追加</button>
      </div>
      {users.map((u) => {
        const mc = getMC(u.id, users);
        const rc = { admin: "#FCA5A5", manager: "#FDBA74", submanager: "#86EFAC", staff: T.dim }[u.role];
        return (
          <div key={u.id} style={{ background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 10, padding: "11px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: u.is_active ? mc : "#4A6AA0", color: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{u.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: u.is_active ? T.tx : T.dim }}>{u.name}</div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>{u.team}</div>
            </div>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: rc + "22", color: rc }}>{ROLES[u.role]}</span>
            <button onClick={() => open(u)} style={bO(T.tx)}>編集</button>
            <button onClick={() => {
              if (window.confirm(`${u.name}を${u.is_active ? "退職済み" : "在籍中"}に変更しますか？`)) {
                setUsers(p => p.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
                showToast(u.is_active ? "👤 退職済みに変更しました" : "✅ 在籍中に戻しました");
              }
            }} style={{ ...bO(u.is_active ? "#F87171" : "#16A34A"), fontSize: 12, padding: "5px 10px" }}>{u.is_active ? "退職" : "復帰"}</button>
          </div>
        );
      })}
      {edit !== null && (
        <Modal title={edit?.id ? "メンバー編集" : "メンバー追加"} onClose={() => setEdit(null)}>
          <Fld label="名前 *"><input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={IS} autoFocus /></Fld>
          <Fld label="チーム"><input value={form.team || ""} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))} style={IS} /></Fld>
          <Fld label="役割">
            <select value={form.role || "staff"} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ ...IS, padding: "9px 8px" }}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="状態">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: T.dim, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> 在籍中
            </label>
          </Fld>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={() => setEdit(null)} style={bO(T.dim)}>キャンセル</button>
            <button onClick={save} style={bP}>保存</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── quick memo ── */
function QuickMemo() {
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);
  const tmr = useRef(null);
  useEffect(() => { dbGet(SK.memo, "").then(setMemo); }, []);
  const save = async () => {
    await dbSet(SK.memo, memo);
    setSaved(true);
    clearTimeout(tmr.current);
    tmr.current = setTimeout(() => setSaved(false), 2000);
  };
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 500, width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg,#B91C1C,#DC2626)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", boxShadow: "0 4px 20px #B91C1C55", fontFamily: T.font }}>📝</button>
      {open && (
        <div style={{ position: "fixed", bottom: 84, right: 24, zIndex: 501, width: 300, background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 14, boxShadow: "0 8px 40px rgba(15,23,42,0.16)", fontFamily: T.font, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#EEF2FF", borderBottom: `1px solid ${T.bd}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.tx }}>📝 クイックメモ</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {saved && <span style={{ fontSize: 11, color: "#86EFAC" }}>✓</span>}
              <button onClick={save} style={{ ...bP, padding: "3px 10px", fontSize: 12 }}>保存</button>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: T.dim, fontSize: 18, cursor: "pointer", fontFamily: T.font }}>✕</button>
            </div>
          </div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} onKeyDown={(e) => { if (e.key === "s" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }} placeholder={"メモを自由に記入...\n\n例）来週：○○の準備\n要確認：シフト\n連絡待ち：衣装業者\n\nCtrl+S で保存"} style={{ width: "100%", minHeight: 200, background: "#FAFAFA", border: "none", color: T.tx, fontSize: 13, padding: "12px 14px", resize: "vertical", outline: "none", fontFamily: T.font, lineHeight: 1.8, boxSizing: "border-box" }} autoFocus />
          <div style={{ padding: "5px 14px", borderTop: `1px solid ${T.bd}`, fontSize: 10, color: T.dim, display: "flex", justifyContent: "space-between" }}>
            <span>Ctrl+S 保存</span><span>{memo.length}字</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ── monthly rules view ── */
function MonthlyView() {
  const { tasks, setTasks, users, showToast, log } = useApp();
  const [rules, setRules] = useState(IRULES);
  const [rl, setRl] = useState(false);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [tagIn, setTagIn] = useState("");
  const [gm, setGm] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => { dbGet(SK.rules, IRULES).then((r) => { setRules(r); setRl(true); }); }, []);
  useEffect(() => { if (rl) dbSet(SK.rules, rules); }, [rules, rl]);
  const open = (r) => { setEdit(r || null); setForm(r ? { ...r } : { title: "", dayType: "date", day: 1, weekday: 1, assignee: "", priority: "mid", tags: [], memo: "" }); setTagIn(""); setShow(true); };
  const save = () => {
    if (!form.title.trim()) { showToast("タイトルを入力", "error"); return; }
    if (edit) setRules((r) => r.map((x) => x.id === edit.id ? { ...x, ...form } : x));
    else setRules((r) => [...r, { ...form, id: uid() }]);
    showToast("✅ 保存"); setShow(false);
  };
  const addTag = (s) => { const t = (s || tagIn).trim().replace(/^#/, ""); if (t && !(form.tags || []).includes(t)) upd("tags", [...(form.tags || []), t]); if (!s) setTagIn(""); };
  const gen = () => {
    const [y, m] = gm.split("-").map(Number);
    const nt = genMonthlyTasks(rules, tasks, y, m);
    if (!nt.length) { showToast(`⚠ ${m}月分はすでに生成済みです`, "error"); return; }
    setTasks((p) => [...p, ...nt]);
    log("monthly_gen", `${m}月分タスク ${nt.length}件を一括生成`);
    showToast(`✅ ${m}月分 ${nt.length}件を生成しました。「今日」タブで確認できます`);
  };
  const gend = [...new Set(tasks.flatMap((t) => (t.tags || []).filter((tg) => tg.startsWith("__m_")).map((tg) => tg.replace("__m_", ""))))].sort();
  const DL = { date: "毎月○日", by: "○日まで", lastWeek: "最終○曜日" };
  return (
    <div>
      <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.dim }}>
        💡 毎月繰り返すタスクをルール登録しておくと、ボタン1つで一括生成できます。
      </div>
      <div style={{ background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 12, padding: "16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 10 }}>🚀 月次タスクを一括生成</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" value={gm} onChange={(e) => setGm(e.target.value)} style={{ ...IS, maxWidth: 150, padding: "7px 10px" }} />
          <button onClick={gen} style={bP}>この月のタスクを生成</button>
          {gend.length > 0 && <span style={{ fontSize: 11, color: T.dim }}>生成済み：{gend.map((m) => parseInt(m.split("-")[1]) + "月").join(" / ")}</span>}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.tx }}>📋 月次ルール（{rules.length}件）</span>
        <button onClick={() => open(null)} style={bP}>＋ ルール追加</button>
      </div>
      {rules.map((r) => {
        const as = users.find((u) => u.id === r.assignee);
        const pri = PRIS.find((p) => p.id === r.priority) || PRIS[1];
        const dd = r.dayType === "lastWeek" ? `最終${WD[r.weekday]}曜日` : `${r.day}日${r.dayType === "by" ? "まで" : ""}`;
        return (
          <div key={r.id} style={{ background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ width: 56, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.tx }}>{dd}</div>
              <div style={{ fontSize: 9, color: T.dim }}>{DL[r.dayType]}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 13, color: T.tx, fontWeight: 500, marginBottom: 2 }}>{r.title}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {as && <span style={{ fontSize: 11, color: getMC(as.id, users) }}>{as.name.split(" ")[0]}</span>}
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: pri.color + "20", color: pri.color }}>{pri.label}</span>
                {(r.tags || []).map((tg) => <span key={tg} style={{ fontSize: 10, color: T.dim }}>#{tg}</span>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => open(r)} style={bO(T.tx)}>編集</button>
              <button onClick={() => { setRules((x) => x.filter((y) => y.id !== r.id)); showToast("🗑 削除"); }} style={bO("#F87171")}>削除</button>
            </div>
          </div>
        );
      })}
      {show && (
        <Modal title={edit ? "ルール編集" : "ルール追加"} onClose={() => setShow(false)}>
          <Fld label="タスク名 *"><input value={form.title || ""} onChange={(e) => upd("title", e.target.value)} style={IS} autoFocus /></Fld>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Fld label="日程タイプ">
              <select value={form.dayType} onChange={(e) => upd("dayType", e.target.value)} style={{ ...IS, padding: "8px" }}>
                <option value="date">毎月○日</option>
                <option value="by">○日まで</option>
                <option value="lastWeek">最終○曜日</option>
              </select>
            </Fld>
            {form.dayType === "lastWeek" ? (
              <Fld label="曜日"><select value={form.weekday} onChange={(e) => upd("weekday", parseInt(e.target.value))} style={{ ...IS, padding: "8px" }}>{WD.map((d, i) => <option key={i} value={i}>{d}曜日</option>)}</select></Fld>
            ) : (
              <Fld label="日にち"><select value={form.day} onChange={(e) => upd("day", parseInt(e.target.value))} style={{ ...IS, padding: "8px" }}>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}日</option>)}</select></Fld>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Fld label="担当者">
              <select value={form.assignee || ""} onChange={(e) => upd("assignee", e.target.value)} style={{ ...IS, padding: "8px" }}>
                <option value="">未設定</option>
                {users.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Fld>
            <Fld label="優先度">
              <select value={form.priority} onChange={(e) => upd("priority", e.target.value)} style={{ ...IS, padding: "8px" }}>
                {PRIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Fld>
          </div>
          <Fld label="タグ">
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
              {(form.tags || []).map((tg) => <span key={tg} onClick={() => upd("tags", (form.tags || []).filter((x) => x !== tg))} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#EEF2FF", color: "#475569", cursor: "pointer" }}>{tg} ✕</span>)}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="タグ" style={{ ...IS, flex: 1 }} />
              <button onClick={() => addTag()} style={bO(T.tx)}>追加</button>
            </div>
          </Fld>
          <Fld label="メモ"><textarea value={form.memo || ""} onChange={(e) => upd("memo", e.target.value)} rows={2} style={{ ...IS, resize: "vertical" }} /></Fld>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={() => setShow(false)} style={bO(T.dim)}>キャンセル</button>
            <button onClick={save} style={bP}>{edit ? "更新" : "追加"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── template manager ── */
function TplManager() {
  const { showToast } = useApp();
  const [tpls, setTpls] = useState(ITPL);
  const [rl, setRl] = useState(false);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [tagIn, setTagIn] = useState("");
  const [quick, setQuick] = useState({ title:"", cat:"", priority:"mid" });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const quickAdd = () => {
    if (!quick.title.trim()) { showToast("タスク名を入力してください", "error"); return; }
    const cats = [...new Set(tpls.map(t=>t.cat))];
    const cat = quick.cat || cats[0] || "タスク管理";
    const newTpl = { id: uid(), title: quick.title.trim(), cat, icon: "✅", priority: quick.priority, tags: [], memo: "" };
    setTpls(t => [...t, newTpl]);
    setQuick(q => ({ ...q, title: "" }));
    showToast("✅ テンプレートを追加しました");
  };
  const CC = { "SNS・広報": "#60A5FA", "生徒対応": "#86EFAC", "タスク管理": "#FFFFFF", "施設・備品": "#FDBA74", "研修・育成": "#C4B5FD", "イベント": "#FCA5A5" };
  const ICONS = ["✅", "📱", "🎬", "📞", "🎭", "📄", "📅", "🔑", "🏷️", "📚", "🌟", "🎪", "💰", "🛒", "📢", "⚡", "📝"];
  useEffect(() => {
    dbGet(SK.tpl, ITPL).then((t) => {
      setTpls(t);
      setRl(true);
      if (!quick.cat && t.length > 0) setQuick(q => ({ ...q, cat: t[0].cat }));
    });
  }, []);
  useEffect(() => { if (rl) dbSet(SK.tpl, tpls); }, [tpls, rl]);
  const cats = [...new Set(tpls.map((t) => t.cat))];
  const open = (t) => { setEdit(t || null); setForm(t ? { ...t } : { title: "", cat: cats[0] || "生徒対応", icon: "✅", priority: "mid", tags: [], memo: "" }); setTagIn(""); setShow(true); };
  const save = () => {
    if (!form.title.trim()) { showToast("タイトルを入力", "error"); return; }
    const fin = { ...form, cat: form.cat === "__new" && form.catNew ? form.catNew : form.cat };
    if (edit) setTpls((t) => t.map((x) => x.id === edit.id ? { ...x, ...fin } : x));
    else setTpls((t) => [...t, { ...fin, id: uid() }]);
    showToast("✅ 保存"); setShow(false);
  };
  const addTag = (s) => { const t = (s || tagIn).trim().replace(/^#/, ""); if (t && !(form.tags || []).includes(t)) upd("tags", [...(form.tags || []), t]); if (!s) setTagIn(""); };
  return (
    <div>
      <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.dim }}>
        ⚡ タスク追加時「よく使うタスクから選ぶ」に表示されるテンプレートを管理します。
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.tx }}>テンプレート（{tpls.length}件）</span>
        <button onClick={() => open(null)} style={bP}>＋ 追加</button>
      </div>

      {/* クイック追加バー */}
      <div style={{ background:"#F8FAFF", border:`1px solid ${T.bd}`, borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.dim, marginBottom:8, letterSpacing:"0.08em" }}>⚡ クイック追加</div>
        <div style={{ display:"flex", gap:6 }}>
          <input
            value={quick.title}
            onChange={e=>setQuick(q=>({...q, title:e.target.value}))}
            onKeyDown={e=>e.key==="Enter" && quickAdd()}
            placeholder="タスク名を入力してEnter..."
            style={{...IS, flex:1, fontSize:13}}
          />
          <select value={quick.cat} onChange={e=>setQuick(q=>({...q, cat:e.target.value}))} style={{...IS, width:120, padding:"8px 6px", fontSize:12}}>
            {[...new Set(tpls.map(t=>t.cat))].map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={quick.priority} onChange={e=>setQuick(q=>({...q, priority:e.target.value}))} style={{...IS, width:70, padding:"8px 6px", fontSize:12}}>
            {PRIS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button onClick={quickAdd} style={{...bP, padding:"8px 16px", whiteSpace:"nowrap"}}>追加</button>
        </div>
      </div>
      {cats.map((cat) => {
        const items = tpls.filter((t) => t.cat === cat);
        const cc = CC[cat] || T.tx;
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cc, marginBottom: 5, paddingBottom: 4, borderBottom: `1px solid ${cc}28` }}>{cat}（{items.length}）</div>
            {items.map((tp) => {
              const pri = PRIS.find((p) => p.id === tp.priority) || PRIS[1];
              return (
                <div key={tp.id} style={{ background: "#FFFFFF", border: `1px solid ${T.bd}`, borderRadius: 10, padding: "9px 14px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 17, flexShrink: 0 }}>{tp.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.tx, fontWeight: 500 }}>{tp.title}</div>
                    <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: pri.color + "20", color: pri.color }}>{pri.label}</span>
                      {(tp.tags || []).map((tg) => <span key={tg} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: cc + "18", color: cc }}>#{tg}</span>)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => open(tp)} style={bO(T.tx)}>編集</button>
                    <button onClick={() => { setTpls((t) => t.filter((x) => x.id !== tp.id)); showToast("🗑 削除"); }} style={bO("#F87171")}>削除</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {show && (
        <Modal title={edit ? "テンプレート編集" : "テンプレート追加"} onClose={() => setShow(false)}>
          <Fld label="タスク名 *"><input value={form.title || ""} onChange={(e) => upd("title", e.target.value)} style={IS} autoFocus /></Fld>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Fld label="カテゴリ">
              <select value={form.cat || ""} onChange={(e) => upd("cat", e.target.value)} style={{ ...IS, padding: "8px" }}>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__new">＋ 新規カテゴリ</option>
              </select>
            </Fld>
            <Fld label="優先度">
              <select value={form.priority} onChange={(e) => upd("priority", e.target.value)} style={{ ...IS, padding: "8px" }}>
                {PRIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Fld>
          </div>
          {form.cat === "__new" && <Fld label="カテゴリ名"><input value={form.catNew || ""} onChange={(e) => upd("catNew", e.target.value)} style={IS} placeholder="例：清掃・メンテ" /></Fld>}
          <Fld label="アイコン">
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {ICONS.map((ic) => <button key={ic} onClick={() => upd("icon", ic)} style={{ width: 34, height: 34, borderRadius: 7, fontSize: 15, border: `1.5px solid ${form.icon === ic ? "#FFFFFF" : T.bd}`, background: form.icon === ic ? "#FFFFFF18" : "transparent", cursor: "pointer", fontFamily: T.font }}>{ic}</button>)}
            </div>
          </Fld>
          <Fld label="タグ">
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
              {(form.tags || []).map((tg) => <span key={tg} onClick={() => upd("tags", (form.tags || []).filter((x) => x !== tg))} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#EEF2FF", color: "#475569", cursor: "pointer" }}>{tg} ✕</span>)}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="タグ" style={{ ...IS, flex: 1 }} />
              <button onClick={() => addTag()} style={bO(T.tx)}>追加</button>
            </div>
          </Fld>
          <Fld label="メモ"><textarea value={form.memo || ""} onChange={(e) => upd("memo", e.target.value)} rows={2} style={{ ...IS, resize: "vertical" }} /></Fld>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={() => setShow(false)} style={bO(T.dim)}>キャンセル</button>
            <button onClick={save} style={bP}>{edit ? "更新" : "追加"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ── activity log ── */
function ActivityLog() {
  const { users } = useApp();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    dbGet(SK.log, []).then((l) => { setLogs(l); setLoaded(true); });
    const iv = setInterval(() => dbGet(SK.log, []).then(setLogs), 15000);
    return () => clearInterval(iv);
  }, []);

  const refresh = () => dbGet(SK.log, []).then(setLogs);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.action === filter);

  const timeAgo = (iso) => {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)  return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff/60)}分前`;
    if (diff < 86400) return `${Math.floor(diff/3600)}時間前`;
    return new Date(iso).toLocaleDateString("ja", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const actionColor = {
    task_add: "#86EFAC", task_update: "#93C5FD", task_delete: "#F87171",
    task_status: "#FDBA74", pool_update: "#C4B5FD", member_update: "#67E8F9", monthly_gen: "#60A5FA",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: T.dim }}>{filtered.length}件の操作記録</span>
        <button onClick={refresh} style={bO(T.dim)}>🔄 更新</button>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {[["all", "すべて", T.tx], ...Object.entries(ACTION_LABELS).map(([k, v]) => [k, v, actionColor[k]])].map(([k, label, color]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontFamily: T.font, border: `1.5px solid ${filter === k ? color : T.bd}`, background: filter === k ? color + "22" : "transparent", color: filter === k ? color : T.dim, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {!loaded && <div style={{ textAlign: "center", padding: "28px 0", color: T.dim }}>読み込み中...</div>}

      {loaded && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: T.dim, fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          まだ操作記録がありません
        </div>
      )}

      {filtered.map((entry) => {
        const u = users.find((x) => x.id === entry.who);
        const mc = u ? getMC(u.id, users) : T.dim;
        const ac = actionColor[entry.action] || T.dim;
        const al = ACTION_LABELS[entry.action] || entry.action;
        return (
          <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 9, background: "#FFFFFF", borderBottom: `1px solid ${T.bd}`, marginBottom: 5 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: mc, color: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {entry.name?.[0] || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: mc, fontWeight: 700 }}>{entry.name}</span>
                <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 5, background: ac + "22", color: ac, whiteSpace: "nowrap" }}>{al}</span>
              </div>
              <div style={{ fontSize: 13, color: T.tx }}>{entry.detail}</div>
            </div>
            <div style={{ fontSize: 11, color: T.dimmer, whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgo(entry.at)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── header ── */
function Header({ page, setPage, tabs, extra }) {
  const { currentUser, setCurrentUser } = useApp();
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#EEF2FF", borderBottom: `1px solid ${T.bd}` }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 22 }}>🕊</span>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ color: T.tx, fontWeight: 700, fontSize: 13, letterSpacing: "0.06em" }}>DG 簡単タスク管理</div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: T.dim }}>{currentUser.name}</span>
          {extra}
          <button onClick={() => setCurrentUser(null)} style={bO(T.dim)}>退出</button>
        </div>
      </div>
      <div style={{ background: "#F8FAFF", borderBottom: `1px solid ${T.bd}`, overflowX: "auto" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", display: "flex", padding: "0 16px" }}>
          {tabs.map(([id, label, badge]) => (
            <button key={id} onClick={() => setPage(id)} style={{ padding: "10px 13px", border: "none", borderBottom: `2.5px solid ${page === id ? T.navy : "transparent"}`, background: "transparent", color: page === id ? T.navy : T.dim, fontSize: 13, cursor: "pointer", fontFamily: T.font, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
              {label}{badge > 0 && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 7, background: "#F8717130", color: "#F87171" }}>{badge}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── admin app ── */
function AdminApp() {
  const { tasks, isFullAdmin } = useApp();
  const [page, setPage] = useState("daily");
  const [sel, setSel] = useState(null);
  const [selP, setSelP] = useState(null);
  const [crt, setCrt] = useState(false);
  const [bulk, setBulk] = useState(false);
  const ovd = tasks.filter(isOvd).length;
  const baseTabs = [
    ["daily", "📅 今日"], ["weekly", "📆 今週"], ["pool", "🏊 プール"],
    ["team", "🌐 チーム", ovd], ["all", "📋 全タスク"], ["actlog", "📜 操作ログ"],
  ];
  const fullTabs = [
    ["monthly", "🔁 月次設定"], ["templates", "⚡ テンプレート"], ["members", "👥 メンバー"],
  ];
  const TABS = isFullAdmin ? [...baseTabs, ...fullTabs] : baseTabs;
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx, fontFamily: T.font }}>
      <Header page={page} setPage={setPage} tabs={TABS} extra={<div style={{display:"flex",gap:6}}>
          <button onClick={()=>setBulk(true)} style={{...bP, background:"linear-gradient(135deg,#1E3A8A,#001B60)", display:"flex", alignItems:"center", gap:5}}>⚡ 一括追加</button>
          <button onClick={() => setCrt(true)} style={bP}>＋ タスク追加</button>
        </div>} />
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: 16 }}>
        {page === "daily"     && <DailyView isAdm />}
        {page === "weekly"    && <WeeklyView isAdm />}
        {page === "pool"      && <PoolView isAdm />}
        {page === "team"      && <TeamView />}
        {page === "monthly"   && <MonthlyView />}
        {page === "templates" && <TplManager />}
        {page === "all"       && <AllTasksList />}
        {page === "actlog"    && <ActivityLog />}
        {page === "members"   && <MemberManager />}
      </div>
      {sel  && <TaskModal task={sel}  onClose={() => setSel(null)} />}
      {selP && <PoolModal item={selP} onClose={() => setSelP(null)} />}
      {crt  && <TaskModal onClose={() => setCrt(false)} />}
      {bulk && <BulkAdd onClose={() => setBulk(false)} />}
      <QuickMemo />
    </div>
  );
}

/* ── staff app ── */
function StaffApp() {
  const { tasks, currentUser, isAdmin } = useApp();
  const [page, setPage] = useState("daily");
  const [crt, setCrt] = useState(false);
  const ovd = tasks.filter((t) => (t.assignees || []).includes(currentUser.id) && isOvd(t)).length;
  const TABS = [["daily", "📅 今日"], ["weekly", "📆 今週"], ["team", "🌐 チーム", ovd], ["all", "📋 全タスク"]];
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx, fontFamily: T.font }}>
      <Header page={page} setPage={setPage} tabs={TABS} extra={<button onClick={() => setCrt(true)} style={bP}>＋ 追加</button>} />
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: 16 }}>
        {page === "daily"  && <DailyView />}
        {page === "weekly" && <WeeklyView />}
        {page === "team"   && <TeamView />}
        {page === "all"    && <AllTasksList />}
      </div>
      {crt && <TaskModal defaultAssignee={currentUser.id} onClose={() => setCrt(false)} />}
    </div>
  );
}

/* ── root ── */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pool, setPool] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState(null);
  const tmr = useRef(null);

  useEffect(() => {
    (async () => {
      const u = await dbGet(SK.u, USERS);
      const t = await dbGet(SK.t, TASKS);
      const po = await dbGet(SK.po, POOL);
      const rules = await dbGet(SK.rules, IRULES);
      const now = new Date();
      const nt = genMonthlyTasks(rules, t, now.getFullYear(), now.getMonth() + 1);
      setUsers(u);
      setTasks(nt.length ? [...t, ...nt] : t);
      setPool(po);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) dbSet(SK.u, users); }, [users, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.t, tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.po, pool); }, [pool, loaded]);

  // ── リアルタイム同期（他のデバイスの変更を受け取る）──
  useEffect(() => {
    if (!loaded) return;
    const channel = sb.channel("dg_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dg_store" }, (payload) => {
        const { key, value } = payload.new;
        if (key === SK.t)  setTasks(value  ?? []);
        if (key === SK.po) setPool(value   ?? []);
        if (key === SK.u)  setUsers(value  ?? []);
      })
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [loaded]);

  const showToast = useCallback((msg, type = "success") => {
    clearTimeout(tmr.current);
    setToast({ msg, type });
    tmr.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const log = useCallback((action, detail) => {
    if (currentUser) addLog(currentUser, action, detail);
  }, [currentUser]);

  const isAdmin = ["admin","manager","submanager"].includes(currentUser?.role);
  const isFullAdmin = ["admin","manager"].includes(currentUser?.role);

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#F8FAFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.dim, fontFamily: T.font, gap: 12 }}>
      <div style={{ fontSize: 32 }}>⚡</div>
      <div style={{ fontSize: 15, color: "#001B60", fontWeight: 700 }}>DG 簡単タスク管理</div>
      <div style={{ fontSize: 13, color: T.dim }}>データを読み込んでいます...</div>
    </div>
  );

  return (
    <Ctx.Provider value={{ users, setUsers, tasks, setTasks, pool, setPool, currentUser, setCurrentUser, login: (u) => setCurrentUser(u), showToast, log, isAdmin }}>
      <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; }
  body { background: #F8FAFF; }
  select option { background: #FFFFFF; color: #0F172A; }
  input[type=date], input[type=datetime-local], input[type=month] { color-scheme: light; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 3px; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
  button:hover { opacity: 0.88; }
  ::placeholder { color: #94A3B8 !important; opacity: 1; }
  :-ms-input-placeholder { color: #94A3B8; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #001B60 !important; box-shadow: 0 0 0 3px rgba(0,27,96,0.08); }
`}</style>
      {!currentUser ? <LoginPage /> : isAdmin ? <AdminApp /> : <StaffApp />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </Ctx.Provider>
  );
}
