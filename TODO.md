- Webpack is loading /lib instead of /es

-----


1. expose @withStore() to access redux store inside component.

2. expose @usesSaga(saga), @usesReducer(reducer), @usesStorePart(storePart) to load saga before component uses it.
    => don't allow loading saga/reducer/storepart any other way.

4. expose "storeParts" folder
    => Loads object { reducer, saga } (default export).
    => Loads "@StorePart" classes
   Those reducer/sagas are always loaded

5. expose "Providers" (to be renamed into "StorePart") decorators.
    5.a. Rename in StorePart
    5.b. Drop ImmutableJS support

6. Expose @container

7. Expose Symbol.reducerName, Symbol.sagaName

8. Expose debug

## CLI

- Add a way to tell rework what peer deps it should install.

## Default Providers / Sub stores

1. (optional) sync router-history with store

```javascript
import RouteProvider from '../app/providers/RouteProvider';
import { syncHistoryWithStore } from 'react-router-redux';

const history = syncHistoryWithStore(navigationHistory, store, {
  selectLocationState: createSelector(
    RouteProvider.locationBeforeTransitions,
    locationBeforeTransitions => ({ locationBeforeTransitions }),
  ),
});

import { createSelector } from 'reselect';
```

2. expose RouteProvider

```javascript
import { LOCATION_CHANGE } from 'react-router-redux';
import { provider, reducer } from '../../common/decorators/provider';

@provider('react-router')
export default class LanguageProvider {
  static locationBeforeTransitions = null;

  /**
   * @private
   */
  @reducer(LOCATION_CHANGE)
  static onLocationChange(payload) {
    this.locationBeforeTransitions = payload;
  }
}
```

3. Expose a LanguageProvider

```javascript
import { call, put } from 'redux-saga/effects';
import { provider, saga, reducer } from '../../common/decorators/provider';
import { storePreferredLocale } from '../../common/get-preferred-locale';
import { installLocale } from '../../common/i18n';

@provider('i18n')
export default class LanguageProvider {
  static locale: string = 'en';

  @saga
  static *changeLocale(newLocale, cookie) {
    yield call(installLocale, newLocale);
    yield put(this._setLocale(newLocale));

    storePreferredLocale(cookie, newLocale);
  }

  /**
   * @private
   */
  @reducer
  static _setLocale(locale) {
    this.locale = locale;
  }
}

```
