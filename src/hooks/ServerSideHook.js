// @flow

import ThreadLocalValue from '../ThreadLocalValue';
import ClientSideHook from './ClientSideHook';

export const currentStoreTl = new ThreadLocalValue();

export default class ServerSideHook extends ClientSideHook {

  constructor() {
    super();

    currentStoreTl.set(this.store);
  }

  preRender(generatedHtmlParts) {
    generatedHtmlParts.footer += `<script>window.__REDUX_SSR__ = ${JSON.stringify(this.store.getState())}</script>`;
  }
}
