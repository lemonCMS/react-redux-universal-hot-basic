import {
  createStore as _createStore, applyMiddleware, compose, combineReducers
} from 'redux';
import clientMiddleware from './middleware/clientMiddleware';
import createReducers from './reducer';

function combine(reducers) {
  return combineReducers(reducers);
}

export function inject(store, reducers) {
  Object.entries(reducers).forEach(([name, reducer]) => {
    if (store.asyncReducers[name]) return;
    store.asyncReducers[name] = reducer.__esModule ? reducer.default : reducer;
  });

  store.replaceReducer(combine(createReducers(store.asyncReducers)));
}

function getNoopReducers(reducers, data) {
  if (!data) return {};
  return Object.keys(data).reduce(
    (prev, next) => (reducers[next] ? prev : { ...prev, [next]: (state = {}) => state }),
    {}
  );
}

export default function createStore({ data, helpers }) {
  const middleware = [clientMiddleware(helpers)];

  if (__CLIENT__ && __DEVELOPMENT__) {
    const logger = require('redux-logger').createLogger({
      collapsed: true
    });
    middleware.push(logger.__esModule ? logger.default : logger);
  }

  const enhancers = [applyMiddleware(...middleware)];

  if (__CLIENT__ && __DEVTOOLS__) {
    const { persistState } = require('redux-devtools');
    let DevTools = require('../containers/DevTools/DevTools');
    DevTools = DevTools.__esModule ? DevTools.default : DevTools;

    Array.prototype.push.apply(enhancers, [
      window.__REDUX_DEVTOOLS_EXTENSION__ ? window.__REDUX_DEVTOOLS_EXTENSION__() : DevTools.instrument(),
      persistState(window.location.href.match(/[?&]debug_session=([^&]+)\b/))
    ]);
  }

  const finalCreateStore = compose(...enhancers)(_createStore);
  const reducers = createReducers();
  const noopReducers = getNoopReducers(reducers, data);
  const store = finalCreateStore(combine({ ...noopReducers, ...reducers }), data);

  store.asyncReducers = {};
  store.inject = _reducers => inject(store, _reducers);

  if (__DEVELOPMENT__ && module.hot) {
    module.hot.accept('./reducer', () => {
      let reducer = require('./reducer');
      reducer = combine((reducer.__esModule ? reducer.default : reducer)(store.asyncReducers));
      store.replaceReducer(reducer);
    });
  }

  return store;
}
