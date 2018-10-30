// @flow

import path from 'path';
import pkg from '../package';

export default class ReduxPlugin {

  constructor(config) {
    this.globalStoresDir = config['global-stores'] || null;
  }

  getHooks() {

    return {
      client: path.resolve(`${__dirname}/../hook-client`),
      server: path.resolve(`${__dirname}/../hook-server`),
    };
  }

  getInstallableDependencies() {
    return pkg.peerDependencies || {};
  }
}
