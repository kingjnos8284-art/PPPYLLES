// @ts-check
import { createLocalBackend } from './local.js';
import { createRemoteBackend } from './remote.js';

/** 切換後端：'local'（目前）或 'remote'（日後帳號／好友上線時）。 */
const BACKEND_MODE = /** @type {'local'|'remote'} */ ('local');

/** @param {'local'|'remote'} mode @returns {import('./types.js').Backend} */
function create(mode) {
  return mode === 'remote' ? createRemoteBackend() : createLocalBackend();
}

export const backend = create(BACKEND_MODE);
