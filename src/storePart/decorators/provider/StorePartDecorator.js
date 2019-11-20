// @flow

import { createSelector } from 'reselect';
import constantCase from 'constant-case';
import { put, takeLatest, all } from 'redux-saga/effects';
import logger from '@reworkjs/core/logger';
import { mapToObject } from '../../../utils/utils';
import { Symbols } from '../index';
import { attemptChangeName, killMethod, replaceMethod } from '../../../utils/method-util';
import { classDecorator, type ClassDecoratorArgument } from '../../../utils/decorators';
import { TYPE_REDUCER } from './ReducerDecorator';
import { TYPE_SAGA } from './SagaDecorator';
import { TYPE_ACTION_GENERATOR } from './ActionDecorator';
import { propertyType, TYPE_STATE, getPropertyMetadata } from './_util';

export type ActionListenerMap = Map<string, Array<Function>>;
type DataBag = {
  ProviderClass: Function,
  sagaList: GeneratorFunction[],
  actionListeners: ActionListenerMap,
  addActionListener: (actionType: string, actionHandler: Function) => void,
  initialState: Object,
  selectDomain: Function,
  domainIdentifier: string,
};

export const ACTION_TYPE_DYNAMIC = Symbol('action-type-dynamic');
const PROVIDER_APP_STATE_ACCESSOR = Symbol('app-state-holder');
const PROVIDER_STATE_ACCESSOR = Symbol('state-holder');
const mutatedProperties = Symbol('mutatedProperties');

// Blacklist universal properties, Function static properties and @storePart symbols.
const PROPERTY_BLACKLIST = Object.getOwnPropertyNames(Object.prototype)

  // use noop instead of Function because Function does not have the "caller" nor "arguments" properties on
  // Safari < 11
  // eslint-disable-next-line
  .concat(Object.getOwnPropertyNames(function noop() {}))
  .concat('displayName'); // used by chrome, same purpose as 'name'.

function denyAccess() {
  throw new Error('Cannot access @storePart state outside of @reducer annotated methods. If you are trying to r/w the state from a @saga, you will need to use "yield put(this.<reducerMethodName>())"');
}

const IMMUTABLE_STATE = {
  set: denyAccess,
  get: denyAccess,
};

const registeredDomains = [];

function parseOptions(options) {
  if (options.length > 1) {
    throw new TypeError('@storePart accepts only one argument. Try @storePart({ domain: <string> }) or @storePart(<string>).');
  }

  if (!options[0]) {
    return {};
  }

  switch (typeof options[0]) {
    case 'string':
    case 'symbol':
      return { domain: options[0] };

    case 'object': {
      const domain = options[0].domain;
      if (typeof domain !== 'string' && typeof domain !== 'symbol') {
        throw new TypeError(`@storePart({ domain: ${JSON.stringify(domain)} }): Invalid domain. Expected string.`);
      }

      return options[0];
    }

    default:
      throw new TypeError(`@storePart(${JSON.stringify(options[0])}): Invalid first argument. Expected string or object.`);
  }
}

/**
 * Decorator that transforms a static class into a provider
 *
 * how it works:
 * - Methods become action builders,
 *   calling them will create an action of the right type with the parameters as payload.
 * - The logic of those methods is moved inside reducers and sagas
 *   depending on if they are annotated with @reducer or @saga
 * - Getting fields return a selector
 * - Setting fields throw an error if called from outside
 *   a @reducer annotated method and call state.set(fieldName, fieldValue) otherwise
 */
const StorePartDecorator = classDecorator((arg: ClassDecoratorArgument) => {
  // if (arg.options.length > 0) {
  //   throw new TypeError('@storePart does not accept options.');
  // }

  const providerClass = arg.target;
  if (Object.getOwnPropertyNames(providerClass.prototype).length > 1) {
    logger.warn(`@storePart ${providerClass.name} has instance properties. This is likely a bug as providers are fully static.`);
  }

  const options = parseOptions(arg.options);
  if (!options.domain) {
    logger.warn(`No domain specified for Provider ${providerClass.name}. Using the class name instead. This might be an issue with minified code as domains names might collide.`);
  }

  const domainIdentifier = options.domain || `RJS-${providerClass.name}`;
  if (registeredDomains.includes(domainIdentifier)) {
    throw new Error(`A provider has already been registered with the domain ${JSON.stringify(domainIdentifier)}. Please make sure all provider domains are unique.`);
  }

  registeredDomains.push(domainIdentifier);

  function selectDomain() {
    return state => {
      const domain = state[domainIdentifier];

      if (domain === void 0) {
        throw new Error(`Could not retrieve the store subdomain ${JSON.stringify(domainIdentifier)}. Either the associated reducer is not loaded or it is loaded under a different name.`);
      }

      return domain;
    };
  }

  providerClass[PROVIDER_STATE_ACCESSOR] = IMMUTABLE_STATE;

  const {
    initialState,
    sagaList,
    actionListeners,
  } = extractFromProvider(providerClass, selectDomain, domainIdentifier);

  function genericReducer(state = initialState, actionData) {
    const type = actionData.type;

    const actionHandler = actionListeners.get(type);
    if (!actionHandler) {
      return state;
    }

    const mutatedObjectMap = new Map();
    providerClass[mutatedProperties] = mutatedObjectMap;
    providerClass[PROVIDER_STATE_ACCESSOR] = state;

    for (const actionHandlerItem of actionHandler) {
      if (Array.isArray(actionData.payload)) {
        actionHandlerItem.apply(providerClass, actionData.payload);
      } else {
        actionHandlerItem.call(providerClass, actionData.payload);
      }
    }

    providerClass[PROVIDER_STATE_ACCESSOR] = IMMUTABLE_STATE;
    providerClass[mutatedProperties] = IMMUTABLE_STATE;

    if (Object.keys(mutatedObjectMap).size === 0) {
      return state;
    }

    return {
      ...state,
      ...mapToObject(mutatedObjectMap),
    };
  }

  genericReducer[Symbols.name] = domainIdentifier;
  attemptChangeName(genericReducer, `${providerClass.name}@reducer`);

  providerClass[Symbols.reducer] = genericReducer;
  providerClass[Symbols.sagas] = sagaList;

  return providerClass;
});

StorePartDecorator.select = function select(property, store) {
  if (!store) {
    throw new TypeError('Expected store (not state) as second parameter.');
  }

  if (typeof property !== 'function' || !property.recomputations) {
    throw new TypeError('The property you passed to Provider.select is not selectable.');
  }

  return property(store.getState());
};

export default StorePartDecorator;

function extractFromProvider(ProviderClass, selectDomain, domainIdentifier) {
  const actionListeners: ActionListenerMap = new Map();
  const sagaList = [];
  const initialState = {};

  const dataBag: DataBag = {
    ProviderClass,
    sagaList,
    actionListeners,
    initialState,
    selectDomain,
    domainIdentifier,
    addActionListener(actionType, actionListener) {
      if (!actionListeners.has(actionType)) {
        actionListeners.set(actionType, []);
      }

      actionListeners.get(actionType).push(actionListener);
    },
  };

  const keys = Object.getOwnPropertyNames(ProviderClass);

  for (const propertyName of keys) {
    if (PROPERTY_BLACKLIST.includes(propertyName)) {
      continue;
    }

    const property = ProviderClass[propertyName];
    const type = property == null ? null : property[propertyType];

    switch (type) {
      case TYPE_ACTION_GENERATOR:
        continue;

      case TYPE_REDUCER:
        extractReducer(propertyName, dataBag);
        continue;

      case TYPE_SAGA:
        extractSaga(propertyName, dataBag);
        continue;

      case TYPE_STATE:
      default:
        extractState(propertyName, dataBag);
    }
  }

  dataBag.initialState = initialState;
  return dataBag;
}

function installActionBuilder(dataBag: DataBag, propertyName) {
  const providerClass = dataBag.ProviderClass;

  const method = providerClass[propertyName];
  const metadata = getPropertyMetadata(method);

  if (!metadata.actionType) {
    return killMethod(providerClass, propertyName);
  }

  const actionType = parseActionType(metadata.actionType, dataBag.domainIdentifier, propertyName);

  function createAction(...args) {
    return { type: actionType, payload: args };
  }

  createAction.actionType = actionType;

  replaceMethod(providerClass, propertyName, createAction);

  return createAction;
}

function parseActionType(actionType, domainIdentifier, propertyName) {
  if (actionType === ACTION_TYPE_DYNAMIC) {
    return `@@${constantCase(domainIdentifier)}/${constantCase(propertyName)}`;
  }

  return actionType;
}

function extractReducer(propertyName: string, dataBag: DataBag) {
  const { ProviderClass, addActionListener } = dataBag;

  const actionListener = ProviderClass[propertyName];
  const metadata = getPropertyMetadata(actionListener);

  for (const actionType of metadata.listenedActionTypes) {
    addActionListener(parseActionType(actionType, dataBag.domainIdentifier, propertyName), actionListener);
  }

  installActionBuilder(dataBag, propertyName);
}

function extractSaga(propertyName: string, dataBag: DataBag) {
  const { ProviderClass, sagaList } = dataBag;

  const property = ProviderClass[propertyName];
  const metadata = getPropertyMetadata(property);

  let callActionHandler;
  const actionBuilder = installActionBuilder(dataBag, propertyName);

  if (metadata.trackStatus) {
    const { initialState, addActionListener } = dataBag;

    const trackActionType = `@@${constantCase(dataBag.domainIdentifier)}/SET_RUNNING/${constantCase(propertyName)}`;
    callActionHandler = function *callActionHandlerWithTracking(action) {
      try {
        yield put({ type: trackActionType, payload: true });
        yield* property.apply(ProviderClass, action.payload);
      } finally {
        yield put({ type: trackActionType, payload: false });
      }
    };

    const runningPropertyName = `${propertyName}.running`;
    installSelector(runningPropertyName, dataBag);
    initialState[runningPropertyName] = false;

    Object.defineProperty(actionBuilder, 'running', Object.getOwnPropertyDescriptor(ProviderClass, runningPropertyName));

    addActionListener(trackActionType, function changeRunningStatus(runningStatus) {
      this[runningPropertyName] = runningStatus; // eslint-disable-line
    });
  } else {
    callActionHandler = function *callActionHandlerWithoutTracking(action) {
      yield* property.apply(ProviderClass, action.payload);
    };
  }

  if (metadata.listenedActionTypes && metadata.listenedActionTypes.size > 0) {
    const actionWatchers = [];

    const takeFunctions = metadata.takeFunctions;
    const tfKeys = takeFunctions ? Object.keys(takeFunctions).map(Number).sort((a, b) => a - b) : null;

    let i = 0;
    for (const listenedActionType of metadata.listenedActionTypes) {
      // select the takeFunction that was used in that @saga decorator.
      const takeFunction = tfKeys ? takeFunctions[orderedClampUp(tfKeys, i)] : takeLatest;
      const realActionType = parseActionType(listenedActionType, dataBag.domainIdentifier, propertyName);
      actionWatchers.push(takeFunction(realActionType, callActionHandler));

      i++;
    }

    function *awaitAction() { // eslint-disable-line
      yield all(actionWatchers);
    }

    attemptChangeName(awaitAction, `${ProviderClass.name}.${property.name}`);
    sagaList.push(awaitAction);
  }
}

function orderedClampUp(numbers: number[], i: number) {
  for (const number of numbers) {
    if (number > i) {
      return number;
    }
  }

  return numbers[numbers.length - 1];
}

function extractState(propertyName: string, dataBag: DataBag) {
  const { ProviderClass, initialState } = dataBag;

  const descriptor = Object.getOwnPropertyDescriptor(ProviderClass, propertyName);
  if (!descriptor) {
    throw new TypeError('Tried getting the descriptor of something that does not exist.');
  }

  if (!descriptor.configurable) {
    throw new TypeError(`@storePart could not redefine property ${JSON.stringify(propertyName)} because it is non-configurable.`);
  }

  if (descriptor.set) {
    throw new TypeError('setters are currently incompatible with @storePart.');
  }

  if (descriptor.get) {
    installGetterSelector(propertyName, dataBag);
  } else {
    initialState[propertyName] = ProviderClass[propertyName];
    installSelector(propertyName, dataBag);
  }
}

function installGetterSelector(propertyName: string, dataBag: DataBag) {
  const { ProviderClass } = dataBag;

  const originalGetter = Object.getOwnPropertyDescriptor(ProviderClass, propertyName).get;

  function getterSelector(applicationState) {
    const originalStateAccessor = ProviderClass[PROVIDER_APP_STATE_ACCESSOR];
    ProviderClass[PROVIDER_APP_STATE_ACCESSOR] = applicationState;

    const result = originalGetter.call(ProviderClass); // eslint-disable-line

    // restore original one in case we're being called by another getter. We don't want to give null back to them.
    ProviderClass[PROVIDER_APP_STATE_ACCESSOR] = originalStateAccessor;

    return result;
  }

  Object.defineProperty(dataBag.ProviderClass, propertyName, {
    get() {
      // Called by a reducer, state properties already return the actual value.
      if (ProviderClass[PROVIDER_STATE_ACCESSOR] !== IMMUTABLE_STATE) {
        return originalGetter.call(ProviderClass);
      }

      // Called by a state getter. Call the selector with the app state to return the actual value.
      if (ProviderClass[PROVIDER_APP_STATE_ACCESSOR]) {
        return getterSelector(ProviderClass[PROVIDER_APP_STATE_ACCESSOR]);
      }

      // Called from outside. Return a selector.
      return getterSelector;
    },
  });
}

function installSelector(propertyName: string, dataBag: DataBag) {
  const { ProviderClass, selectDomain } = dataBag;

  const selectProperty = createSelector(
    selectDomain(),
    subState => subState[propertyName],
  );

  attemptChangeName(selectProperty, `select_${propertyName}`);

  // create selector
  Object.defineProperty(ProviderClass, propertyName, {
    get() {
      // Called by a state getter. Call the selector with the app state to return the actual value.
      if (ProviderClass[PROVIDER_APP_STATE_ACCESSOR]) {
        return selectProperty(ProviderClass[PROVIDER_APP_STATE_ACCESSOR]);
      }

      // called from outside. Return selector.
      const providerState = ProviderClass[PROVIDER_STATE_ACCESSOR];
      if (providerState === IMMUTABLE_STATE) {
        return selectProperty;
      }

      // Called from reducer, return actual value.
      if (ProviderClass[mutatedProperties].has(propertyName)) {
        return ProviderClass[mutatedProperties].get(propertyName);
      }

      return providerState[propertyName];
    },

    set(value) {
      ProviderClass[mutatedProperties].set(propertyName, value);
    },
  });
}

