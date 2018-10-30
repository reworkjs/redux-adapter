// @flow

import { currentStoreTl } from '../hooks/ServerSideHook';

/**
 * Returns the store of the currently rendering react app.
 *
 * On the server side, the store is depends on the
 * current execution context.
 *
 * This ensures we get the right store, even
 * if the react instance that is currently being rendered
 * changes due to async operations.
 */
export default function getCurrentStore() {
  return currentStoreTl.get();
}
