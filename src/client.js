/**
 * THIS IS THE ENTRY POINT FOR THE CLIENT, JUST LIKE server.js IS THE ENTRY POINT FOR THE SERVER.
 */
import '@babel/polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import _get from 'lodash/get';
import { renderRoutes } from 'react-router-config';
import { createBrowserHistory } from 'history';
import { BrowserRouter } from 'react-router-dom';
import Loadable from 'react-loadable';
import { AppContainer as HotEnabler } from 'react-hot-loader';
import localForage from 'localforage';
import CookiesJS from 'universal-cookie';
import { authorize, trigger, triggerWait } from '@slumdogjs/redial';
import { CookieStorage } from '@wicked_query/redux-persist-cookie-storage';
import { PersistComponent } from '@slumdogjs/persist-component';
import createStore from 'redux/create';
import { Provider } from 'react-redux';
import apiClient from 'helpers/apiClient';
import routes from 'routes';
import isOnline from 'utils/isOnline';
import asyncMatchRoutes from 'utils/asyncMatchRoutes';
import ReduxAsyncConnect from 'components/ReduxAsyncConnect/ReduxAsyncConnect';

const cookies = new CookiesJS();
const cookiesStorage = new CookieStorage(cookies, {
  setCookieOptions: {
    path: '/'
  }
});

const dest = document.getElementById('content');

const client = apiClient();
const providers = {
  client,
  cookies: CookiesJS,
  cookiesStorage
};

(async () => {
  const online = window.__data ? true : await isOnline();
  const history = createBrowserHistory();
  const store = createStore({
    history,
    data: {
      ...window.__data,
      online
    },
    helpers: providers
  });

  const hydrate = async _routes => {
    const { components, match, params } = await asyncMatchRoutes(_routes, history.location.pathname);
    const triggerLocals = {
      ...providers,
      store,
      match,
      params,
      history,
      location: history.location
    };

    const persistAuth = (state, lastState) => {
      if (
        _get(state, 'token', null) !== null
        && _get(state, 'token') !== _get(lastState, 'token')
        && _get(state, 'loggedIn', false) === true
      ) {
        cookiesStorage.setItem('token', state.token);
      }
      return { token: state.token, loggedIn: state.loggedIn };
    };

    await authorize('authorized', components, triggerLocals).then(async () => {
      await triggerWait('fetch', components, triggerLocals);
      await trigger('defer', components, triggerLocals);

      ReactDOM.hydrate(
        <HotEnabler>
          <BrowserRouter>
            <Provider store={store}>
              <ReduxAsyncConnect routes={_routes} store={store} helpers={providers} history={history}>
                <PersistComponent
                  storage={cookiesStorage}
                  modules={[{ auth: persistAuth }, { cookieStorage: 'cookieStorage' }]}
                >
                  <PersistComponent storage={localForage} modules={['quote', 'storage']}>
                    {renderRoutes(_routes)}
                  </PersistComponent>
                </PersistComponent>
              </ReduxAsyncConnect>
            </Provider>
          </BrowserRouter>
        </HotEnabler>,
        dest
      );
    });
  };

  await Loadable.preloadReady();

  await hydrate(routes);

  // Hot reload
  if (module.hot) {
    module.hot.accept('./routes', () => {
      const nextRoutes = require('./routes');
      hydrate(nextRoutes.__esModule ? nextRoutes.default : nextRoutes).catch(err => {
        console.error('Error on routes reload:', err);
      });
    });
  }

  // Dev tools
  if (__DEVTOOLS__ && !window.__REDUX_DEVTOOLS_EXTENSION__) {
    const devToolsDest = document.createElement('div');
    window.document.body.insertBefore(devToolsDest, null);
    const DevTools = require('./containers/DevTools/DevTools');
    ReactDOM.hydrate(<DevTools />, devToolsDest);
  }

  // Service worker
  if (!__DEVELOPMENT__ && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/dist/service-worker.js', { scope: '/' });
      registration.onupdatefound = () => {
        // The updatefound event implies that reg.installing is set; see
        // https://w3c.github.io/ServiceWorker/#service-worker-registration-updatefound-event
        const installingWorker = registration.installing;

        installingWorker.onstatechange = () => {
          switch (installingWorker.state) {
            case 'installed':
              if (navigator.serviceWorker.controller) {
                // At this point, the old content will have been purged and the fresh content will
                // have been added to the cache.
                // It's the perfect time to display a "New content is available; please refresh."
                // message in the page's interface.
                console.log('New or updated content is available.');
              } else {
                // At this point, everything has been precached.
                // It's the perfect time to display a "Content is cached for offline use." message.
                console.log('Content is now available offline!');
              }
              break;
            case 'redundant':
              console.error('The installing service worker became redundant.');
              break;
            default:
          }
        };
      };
    } catch (error) {
      console.log('Error registering service worker: ', error);
    }

    await navigator.serviceWorker.ready;
    console.log('Service Worker Ready');
  }
})();
