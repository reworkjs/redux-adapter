// @flow

import React from 'react';
import { Provider } from 'react-redux';
import createConfiguredStore from '../create-store';

export const allStores = new Set();

export default class ClientSideHook {

  constructor() {
    this.store = createConfiguredStore();

    // only used by client app
    allStores.add(this.store);
  }

  wrapRootComponent(component) {

    return (
      <Provider store={this.store}>
        {component}
      </Provider>
    );
  }

  postRequest() {
    allStores.delete(this.store);
  }
}
