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

module.exports = function getGlobalStores() {

  const getPluginInstance = require('@reworkjs/core/lib/internals/get-plugins').getPluginInstance;
  const plugin = getPluginInstance(require('../../../lib/plugin').default);

  const globalStoresDir = plugin.globalStoresDir;

  let filePromise;

  if (globalStoresDir == null) {
    filePromise = Promise.resolve([]);
  } else {
    filePromise = fs.promises.readdir(globalStoresDir)
      .catch(() => [])
      .then(files => files.map(file => path.join(globalStoresDir, file)));
  }

  return filePromise.then(files => {
    const importArray = `[${files.map(hookFile => `require(${JSON.stringify(hookFile)})`).join(',')}]`;

    return { code: `export default () => ${importArray};` };
  });
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
