// @ts-check
import { migrate } from '../core/state.js';

/**
 * 本機版後端：存檔放在瀏覽器 localStorage，沒有帳號與好友。
 */

const SAVE_KEY = 'pppylles.save';
const GUEST_KEY = 'pppylles.guestId';

function guestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = 'guest-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return 'guest-temp';
  }
}

const notYet = () => Promise.reject(new Error('此功能尚未開放'));

/** @returns {import('./types.js').Backend} */
export function createLocalBackend() {
  return {
    mode: 'local',
    auth: {
      supported: false,
      getCurrentUser: async () => ({ id: guestId(), displayName: '訪客', isGuest: true }),
      signIn: notYet,
      signOut: async () => {},
    },
    save: {
      async load() {
        try {
          const raw = localStorage.getItem(SAVE_KEY);
          return raw ? migrate(JSON.parse(raw)) : null;
        } catch {
          return null;
        }
      },
      async save(state) {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        } catch {
          // 無痕模式或空間不足時忽略，不讓遊戲中斷
        }
      },
      async clear() {
        try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      },
    },
    social: {
      supported: false,
      listFriends: async () => [],
      addFriend: notYet,
      visitTank: notYet,
    },
    time: {
      now: async () => Date.now(),
    },
  };
}
