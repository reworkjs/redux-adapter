// @flow

import { methodDecorator, type MethodDecoratorArgument } from '../../../utils/decorators';
import { getPropertyMetadata, setPropertyType } from './_util';
import { ACTION_TYPE_DYNAMIC } from './StorePartDecorator';

export const TYPE_REDUCER = Symbol('TYPE_REDUCER');
const EMPTY_OBJ = {};
Object.freeze(EMPTY_OBJ);

const USAGE = '@reducer([actionType])';

export default methodDecorator((arg: MethodDecoratorArgument) => {

  parseOptions(arg);

  if (!setPropertyType(arg.descriptor.value, TYPE_REDUCER)) {
    throw new TypeError(`${USAGE}: Cannot be used on a method that has already been marked as either a @saga or an @action.`);
  }

  return transform(arg);
});

export function parseOptions(arg: MethodDecoratorArgument) {
  const options = arg.options;

  if (options.length > 1) {
    throw new TypeError(`${USAGE} only accepts one argument. ${options.length} provided`);
  }

  if (options[0] == null) {
    return EMPTY_OBJ;
  }

  const objArg = typeof options[0] === 'object' ? options[0] : { actionType: options[0] };

  if (objArg.actionType != null && typeof objArg.actionType !== 'string' && typeof objArg.actionType !== 'function') {
    throw new TypeError(`${USAGE}: Invalid option actionType: expected string, a reducer/saga method, or undefined.`);
  }

  arg.options = objArg;

  return objArg;
}

export function transform(arg: MethodDecoratorArgument) {
  const { descriptor, options } = arg;
  const property = descriptor.value;

  const metadata = getPropertyMetadata(property);
  metadata.listenedActionTypes = metadata.listenedActionTypes || new Set();

  if (!options.actionType) {
    metadata.actionType = ACTION_TYPE_DYNAMIC;
    metadata.listenedActionTypes.add(metadata.actionType);
  } else if (Array.isArray(options.actionType)) {
    for (const actionType of options.actionType) {
      metadata.listenedActionTypes.add(parseActionType(actionType));
    }
  } else {
    metadata.listenedActionTypes.add(parseActionType(options.actionType));
  }

  return descriptor;
}

function parseActionType(actionType) {
  if (typeof actionType === 'function') {
    const actionHandler = actionType;
    if (!actionHandler.actionType) {
      throw new TypeError(`Method ${actionHandler.name} does not have an action type. Is it correctly decorated ?`);
    }

    return actionHandler.actionType;
  }

  return actionType;
}
