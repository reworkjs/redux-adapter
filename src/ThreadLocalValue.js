// @flow

import asyncHooks from 'async_hooks';

export default class ThreadLocalValue {
  _values = new Map();

  constructor() {
    const asyncHook = asyncHooks.createHook({
      init: (asyncId, type, triggerAsyncId) => {
        const existing = this._values.get(triggerAsyncId);
        if (existing) {
          this._values.set(asyncId, existing);
        }
      },
      destroy: asyncId => {
        this._values.delete(asyncId);
      },
    });

    asyncHook.enable();
  }

  set(val) {
    this._values.set(asyncHooks.executionAsyncId(), val);
  }

  get() {
    return this._values.get(asyncHooks.executionAsyncId());
  }
}
