// @flow

import React from 'react';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { registerStorePart } from './public-api';

export type ContainerDecoratorConfig = {
  state: ?{ [key: string]: Function },
  dispatchers: ?{ [key: string]: Function },
  actions: ?{ [key: string]: Function },
};

function checkInvalidKeys(conf) {
  const authorizedKeys = ['state', 'dispatchers', 'actions', 'connectOptions', 'stores'];

  const invalidKeys = Object.keys(conf).filter(key => !authorizedKeys.includes(key));

  if (invalidKeys.length > 0) {
    throw new TypeError(`@withRedux(): configuration contains invalid entries "${invalidKeys.join('", "')}". Only keys allowed are "${authorizedKeys.join('", "')}"`);
  }
}

function objNoop() {
  return {};
}

/**
 * Configure a container.
 *
 * @param {!Object} config.stores A list of store parts used by this component.
 * @param {!Object} config.state An mapping of prop names => redux state selector.
 * @param {!Object} config.dispatchers An mapping of prop names => function that will receive dispatch and arguments.
 * @param {!Object} config.actions An mapping of prop names => redux action.
 *
 * @example
 * \@container({
 *   state: {
 *     loggedIn: function() { // this must be a function that returns a selector.
 *       return function selectLoggedInState(state) {
 *         return state.get('loggedIn');
 *       }
 *     },
 *   },
 * })
 * class SomeContainer {}
 *
 * @example
 * \@withRedux({
 *   state: {
 *     loggedIn: SecurityProvider.loggedIn,
 *   },
 *   actions: {
 *     onLogin: function(username, password) {
 *       return { type: 'LOGIN', payload: { username, password } }; // return an action!
 *     },
 *   },
 * })
 * class SomeContainer {}
 *
 * @example
 * \@withRedux({
 *   dispatchers: {
 *     onLogin: function(dispatch, username, password) {
 *       return dispatch({ type: 'LOGIN', payload: { username, password } }); // dispatch an action!
 *     },
 *   },
 * })
 * class SomeContainer {}
 */
export default function withRedux(config: ContainerDecoratorConfig = {}) {

  checkInvalidKeys(config);

  let mapStateToProps;
  if (!config.state) {
    mapStateToProps = objNoop;
  } else {
    const state = config.state;
    const keys = Object.keys(state);
    const values = keys.map(key => {
      const val = state[key];
      if (typeof val !== 'function') {
        throw new TypeError(`@withRedux({ state[${JSON.stringify(key)}] }) is not a function.`);
      }

      return val;
    });

    mapStateToProps = createSelector(
      ...values,
      (...args) => {
        const merge = {};

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          merge[key] = args[i];
        }

        return merge;
      },
    );
  }

  function mapDispatchToProps(dispatch) {
    const result = {};

    if (config.dispatchers) {
      for (const key of Object.keys(config.dispatchers)) {
        const dispatcher = config.dispatchers[key];

        if (typeof dispatcher !== 'function') {
          throw new TypeError(`@withRedux({ dispatchers[${JSON.stringify(key)}] }) is not a function.`);
        }

        result[key] = function callDispatcher(...args) {
          dispatcher(dispatch, ...args);
        };
      }
    }

    if (config.actions) {
      for (const key of Object.keys(config.actions)) {
        const actionBuilder = config.actions[key];

        if (typeof actionBuilder !== 'function') {
          throw new TypeError(`@withRedux({ actions[${JSON.stringify(key)}] }) is not a function.`);
        }

        result[key] = function dispatchAction(...args) {
          dispatch(actionBuilder(...args));
        };
      }
    }

    return result;
  }

  const connector = connect(mapStateToProps, mapDispatchToProps, null, config.connectOptions);

  return function setupContainer(wrappedComponent) {
    let wrapperComponent = connector(wrappedComponent);

    if (Array.isArray(config.stores) && config.stores.length > 0) {
      wrapperComponent = withStores(wrapperComponent, config.stores);
    }

    return wrapperComponent;
  };
}

function withStores(WrappedComponent, stores) {

  return class WithStoreParts extends React.Component {

    constructor(props) {
      super(props);

      for (const store of stores) {
        registerStorePart(store);
      }
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
}
