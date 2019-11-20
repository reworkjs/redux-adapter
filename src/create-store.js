// @flow

import { createStore as createReduxStore, applyMiddleware, compose, combineReducers } from 'redux';
import createSagaMiddleware from 'redux-saga';
import global from 'global';
import { installSagas } from './install-sagas';
import { markReducerInstalled, reducerArrayToMap } from './install-reducers';
import { Symbols } from './storePart/decorators';
import loadGlobalStores from './storePart/global-store-parts';

// TODO reinstall debug (only front-end)
// import debug from '@reworkjs/core/debug';
// debug.store

const devtools = global.devToolsExtension || (() => noop => noop);

export default function createConfiguredStore() {
  // Create the store with two middlewares
  // 1. sagaMiddleware: Makes redux-sagas work
  // 2. routerMiddleware: Syncs the location/URL path to the state

  const sagaMiddleware = createSagaMiddleware();

  const middlewares = [
    sagaMiddleware,

    // TODO re-install react-router-redux? Is it useful?
    // routerMiddleware(history),
  ];

  if (process.env.NODE_ENV !== 'production') {
    // ensure state is immutable (check is disabled in production).
    middlewares.unshift(require('redux-immutable-state-invariant').default());
  }

  const enhancers = [
    replaceActionDispatcher,
    applyMiddleware(...middlewares),
    devtools(),
  ];

  const initialState = global.__REDUX_SSR__ || {};

  const initialReducers = [];
  const initialSagas = [];

  for (const storeModule of loadGlobalStores()) {
    const store = storeModule.default || storeModule;

    initialReducers.push(store[Symbols.reducer]);
    initialSagas.push(...store[Symbols.sagas]);
  }

  /* this part is too tightly coupled with install-reducers */
  const initialReducersMap = reducerArrayToMap(initialReducers);
  const store = createReduxStore(
    combineReducers(initialReducersMap),
    initialState,
    compose(...enhancers),
  );

  markReducerInstalled(store, initialReducersMap);

  /* end of coupled part */

  const activeSagas = [];

  // Create hook for async sagas
  store.runSaga = function runSaga(saga) {
    if (activeSagas.includes(saga)) {
      return;
    }

    sagaMiddleware.run(saga);
    activeSagas.push(saga);
  };

  installSagas(store, initialSagas);

  return store;
}

function replaceActionDispatcher(actualCreateStore) {
  return function fakeCreateStore(a, b, c) {
    const store = actualCreateStore(a, b, c);
    const nativeDispatch = store.dispatch;

    Object.assign(store, {
      dispatch(arg) {
        if (Array.isArray(arg)) {
          for (const action of arg) {
            nativeDispatch.call(this, action);
          }
        } else {
          nativeDispatch.call(this, arg);
        }
      },
    });

    return store;
  };
}
