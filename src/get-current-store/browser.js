// @flow

import { allStores } from '../hooks/ClientSideHook';

/**
 * Returns the store of the currently rendering react app.
 *
 * On the client side, the store is created only once and is a singleton.
 */
export default function getCurrentStore() {
  // allStores should only ever have one item on client-side.
  return allStores.values().next().value;
}
