// @flow

import { allStores } from './hooks/ClientSideHook';
import {
  addGlobalReducer,
  installReducers,
} from './install-reducers';
import getCurrentStore from './get-current-store';
import { addGlobalSaga, installSagas } from './install-sagas';
import { Symbols } from './storePart/decorators';

export function getStore() {

  const store = getCurrentStore();

  if (process.env.NODE_ENV !== 'production') {
    if (!store) {
      throw new Error('[redux] Cannot get store. Either this is a bug or getStore has been called outside of a react context.');
    }
  }

  return store;
}

export function registerReducer(reducer) {
  installReducers(getStore(), reducer);
}

// export function registerGlobalReducer(reducer) {
//   if (allStores.size > 0) {
//     throw new Error('Global reducers cannot be registered after a store has been created due to SSR.');
//   }
//
//   addGlobalReducer(reducer);
// }

// export function registerGlobalStorePart(storePart) {
//   registerGlobalReducer(storePart[Symbols.reducer]);
//   registerGlobalSaga(storePart[Symbols.sagas]);
// }

// ==

export function registerSaga(saga) {
  installSagas(getStore(), saga);
}

// export function registerGlobalSaga(sagas) {
//   if (!Array.isArray(sagas)) {
//     sagas = [sagas];
//   }
//
//   for (const saga of sagas) {
//     addGlobalSaga(saga);
//   }
//
//   for (const store of allStores) {
//     installSagas(store);
//   }
// }

export function registerStorePart(storePart) {
  registerReducer(storePart[Symbols.reducer]);
  registerSaga(storePart[Symbols.sagas]);
}

// TODO:
// client: use singleton store
// server: hook on all active stores? (as these functions are very likely to be run only once).
// or on current thread-local store (but must be loaded during component loading. Maybe using a decorator?)
// @usesReducer(xxx)
// @usesSaga(xxx)
// OR BOTH!

// @withActions()
// @withStore()
// @withProvider()

export {
  storePart,
  storePart as StorePart,
  saga,
  saga as Saga,
  reducer,
  reducer as Reducer,
  action,
  action as Action,
  throttleSaga,
} from './storePart/decorators';

export { default as withRedux, default as WithRedux } from './withRedux';
