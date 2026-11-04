// @ts-check
/**
 * 後端服務介面定義。
 *
 * 遊戲本體只透過這些介面存取「需要後端的功能」。
 * 現在使用 local（瀏覽器本機）實作；日後接上伺服器時，
 * 新增一組 remote 實作並在 services/index.js 切換即可，遊戲程式不用改。
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} displayName
 * @property {boolean} isGuest
 */

/**
 * 帳號
 * @typedef {Object} AuthService
 * @property {() => Promise<User>} getCurrentUser   目前使用者（未登入時為訪客）
 * @property {() => Promise<User>} signIn           登入（local 版不支援）
 * @property {() => Promise<void>} signOut
 * @property {boolean} supported                    是否已開放帳號功能（UI 依此顯示按鈕）
 */

/**
 * 存檔
 * @typedef {Object} SaveService
 * @property {() => Promise<import('../core/state.js').GameState|null>} load
 * @property {(state: import('../core/state.js').GameState) => Promise<void>} save
 * @property {() => Promise<void>} clear
 */

/**
 * @typedef {Object} Friend
 * @property {string} id
 * @property {string} displayName
 */

/**
 * 好友／多人（預留）
 * @typedef {Object} SocialService
 * @property {boolean} supported
 * @property {() => Promise<Friend[]>} listFriends
 * @property {(code: string) => Promise<Friend>} addFriend
 * @property {(friendId: string) => Promise<import('../core/state.js').GameState>} visitTank  參觀好友水族箱（唯讀）
 */

/**
 * 時間來源。離線收益依此計算；上線後改用伺服器時間可防止改手機時間作弊。
 * @typedef {Object} TimeService
 * @property {() => Promise<number>} now   毫秒
 */

/**
 * @typedef {Object} Backend
 * @property {string} mode
 * @property {AuthService} auth
 * @property {SaveService} save
 * @property {SocialService} social
 * @property {TimeService} time
 */

export {};
