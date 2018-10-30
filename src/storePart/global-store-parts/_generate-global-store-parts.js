/**
 * Exports the list of providers based on the setup config.
 *
 * Using webpack.
 */

// This file is run by webpack, and the code it generates is the one that will actually be used
// See: val-loader

/* eslint-disable import/no-commonjs */

const fs = require('fs');
const path = require('path');

module.exports = async function getGlobalStores() {

  const plugin = require('../../../lib/plugin').default.instance;

  const globalStoresDir = plugin.globalStoresDir;

  let files;

  if (globalStoresDir == null) {
    files = [];
  } else {
    try {
      files = (await fs.promises.readdir(globalStoresDir)).map(file => path.join(globalStoresDir, file));
    } catch (e) {
      files = [];
    }
  }

  const importArray = `[${files.map(hookFile => `require(${JSON.stringify(hookFile)})`).join(',')}]`;

  return { code: `export default () => ${importArray};` };
};

// import { getModulesFromWpContext } from '../utils/webpack-utils';
// import { isProvider } from './decorators/index';
//
// export type Provider = {
//   reducer: ?Function,
//   sagas: ?Function[],
// };
//
// const providers: Provider[] = getModulesFromWpContext(
//   require.context('@@directories.providers', true, /\.jsx?$/),
// ).filter(selectProvider);
//
// function selectProvider(item) {
//   if (item == null) {
//     return false;
//   }
//
//   if (isProvider(item)) {
//     return true;
//   }
//
//   if (typeof item === 'object') {
//     return Object.prototype.hasOwnProperty.call(item, 'reducer') || Object.prototype.hasOwnProperty.call(item, 'sagas');
//   }
//
//   return false;
// }
//
// export default providers;
//
