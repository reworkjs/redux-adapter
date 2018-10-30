// @flow

import { combineReducers } from 'redux';
import { toArray } from './utils/utils';
import { Symbols } from './storePart/decorators/index';

const REGISTERED_REDUCERS_KEY = Symbol('registered-reducers');

/**
 * Creates a reducer that uses exclusively
 */
export function reducerArrayToMap(reducers) {
  const reducerMap = Object.create(null);

  for (const reducer of reducers) {
    reducerMap[getReducerName(reducer)] = reducer;
  }

  Object.freeze(reducerMap);

  return reducerMap;
}

export function markReducerInstalled(store, reducers) {
  store[REGISTERED_REDUCERS_KEY] = reducers;
}

function getReducerName(reducer) {
  return reducer[Symbols.name] || reducer.name;
}

/**
 *
 * @param store
 * @param reducers
 */
export function installReducers(store, reducers = []) {
  reducers = toArray(reducers);

  const registeredReducers = store[REGISTERED_REDUCERS_KEY]
    ? Object.assign(Object.create(null), store[REGISTERED_REDUCERS_KEY])
    : Object.create(null);

  let dirty = false;
  for (const reducer of reducers) {
    const reducerName = getReducerName(reducer);

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducerName !== 'string' || !reducerName) {
        throw new TypeError('injectAsyncReducer: reducer is missing a name.');
      }

      if (typeof reducer !== 'function') {
        throw new TypeError('injectAsyncReducer: reducer is not a function.');
      }
    }

    const existingReducer = registeredReducers[reducerName];
    if (existingReducer) {
      if (existingReducer !== reducers) {
        continue;
      }

      throw new Error(`Trying to register two different reducers sharing the same name "${reducerName}".`);
    }

    registeredReducers[reducerName] = reducer;
    dirty = true;
  }

  if (dirty) {
    Object.freeze(registeredReducers);
    store.replaceReducer(combineReducers(registeredReducers));
  }
}

// TODO: StoreParts should register their reducer one way or another.
/*
  for (const provider: Provider of providers) {

    const reducer = provider[Symbols.reducer] || provider.reducer;
    if (!reducer) {
      continue;
    }

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducer !== 'function') {
        throw new Error('One of your providers exported a reducer that is not a function');
      }
    }

    const name = reducer[Symbols.name] || reducer.name;

    if (process.env.NODE_ENV !== 'production') {
      if (!name) {
        throw new Error('One of your providers exported a nameless reducer, please name it');
      }
    }

    reducers[name] = reducer;
  }
 */

/*
TODO: replace reducer on all stores if hot module
// Make reducers hot reloadable, see http://mxs.is/googmo
if (module.hot) {
  const createReducers = require('../create-reducer').default;
  const nextReducers = createReducers(store.asyncReducers);

  store.replaceReducer(nextReducers);
}
*/
