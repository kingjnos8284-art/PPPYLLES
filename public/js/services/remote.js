// @ts-check
/**
 * 線上版後端（預留，尚未實作）。
 *
 * 接上伺服器時的建議做法：
 * 1. 帳號：Supabase Auth / Firebase Auth / Netlify Identity 擇一
 * 2. 存檔：GameState 整包以 JSON 存在資料表 saves(user_id, data, updated_at)
 * 3. 時間：由伺服器回傳現在時間（或在伺服器端計算離線收益）
 * 4. 好友：friends(user_id, friend_id)，參觀時讀取對方 saves 的唯讀副本
 * 5. API 端點放在 /netlify/functions/，網址為 /api/*（netlify.toml 已設定轉址）
 *
 * 實作完成後，把 services/index.js 的 BACKEND_MODE 改成 'remote'。
 */

/** @returns {import('./types.js').Backend} */
export function createRemoteBackend() {
  throw new Error('線上後端尚未實作，請先使用 local 模式');
}
