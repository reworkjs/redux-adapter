import { toArray } from './utils/utils';

export function installSagas(store, sagas = []) {
  sagas = toArray(sagas);

  for (const saga of sagas) {
    store.runSaga(saga);
  }
}
