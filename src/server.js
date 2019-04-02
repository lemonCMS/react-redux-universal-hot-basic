import fs from 'fs';
import path from 'path';
import express from 'express';
import React from 'react';
import ReactDOM from 'react-dom/server';
import morgan from 'morgan';
import favicon from 'serve-favicon';
import compression from 'compression';
import httpProxy from 'http-proxy';
import PrettyError from 'pretty-error';
import http from 'http';
import { StaticRouter } from 'react-router';
import { renderRoutes } from 'react-router-config';
import { createMemoryHistory } from 'history';
import Loadable from 'react-loadable';
import { getBundles } from 'react-loadable/webpack';
import { CookieStorage } from '@wicked_query/redux-persist-cookie-storage';
import cookiesMiddleware from 'universal-cookie-express';
import { authorizeWait, triggerWait } from '@slumdogjs/redial';
import PersistServer from '@slumdogjs/persist-component/lib/PersistServer';
import config from './config';
import createStore from './redux/create';
import apiClient from './helpers/apiClient';
import Html from './helpers/Html';
import routes from './routes';
import { getChunks, waitChunks } from './utils/chunks';
import asyncMatchRoutes from './utils/asyncMatchRoutes';
import ReduxAsyncConnect from './components/ReduxAsyncConnect/ReduxAsyncConnect';

const pretty = new PrettyError();
const chunksPath = path.join(__dirname, '..', 'static', 'dist', 'loadable-chunks.json');

process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection at: Promise ', p, pretty.render(reason)));

const targetUrl = `http://${config.apiHost}:${config.apiPort}`;
const app = express();
const server = new http.Server(app);
const proxy = httpProxy.createProxyServer({
  target: targetUrl,
  ws: true
});

app
  .use(morgan('dev', { skip: req => req.originalUrl.indexOf('/ws') !== -1 }))
  .use(cookiesMiddleware())
  .use(compression())
  .use(favicon(path.join(__dirname, '..', 'static', 'favicon.ico')))
  .use('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, '..', 'static', 'manifest.json')));

app.use('/dist/service-worker.js', (req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-store');
  return next();
});

app.use('/dist/dlls/:dllName.js', (req, res, next) => {
  fs.access(path.join(__dirname, '..', 'static', 'dist', 'dlls', `${req.params.dllName}.js`), fs.constants.R_OK, err => err ? res.send(`console.log('No dll file found (${req.originalUrl})')`) : next());
});

app.use(express.static(path.join(__dirname, '..', 'static')));

app.use((req, res, next) => {
  res.setHeader('X-Forwarded-For', req.ip);
  return next();
});

// Proxy to API server
app.use('/api', (req, res) => {
  proxy.web(req, res, { target: targetUrl });
});

app.use('/ws', (req, res) => {
  proxy.web(req, res, { target: `${targetUrl}/ws` });
});

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

// added the error handling to avoid https://github.com/nodejitsu/node-http-proxy/issues/527
proxy.on('error', (error, req, res) => {
  if (error.code !== 'ECONNRESET') {
    console.error('proxy error', error);
  }
  if (!res.headersSent) {
    res.writeHead(500, { 'content-type': 'application/json' });
  }

  const json = {
    error: 'proxy_error',
    reason: error.message
  };
  res.end(JSON.stringify(json));
});

app.use(async (req, res) => {
  if (__DEVELOPMENT__) {
    // Do not cache webpack stats: the script file would change since
    // hot module replacement is enabled in the development env
    webpackIsomorphicTools.refresh();
  }

  // const cookieJar = new NodeCookiesWrapper(req.cookies);
  const cookiesStorage = new CookieStorage(req.universalCookies, {
    setCookieOptions: {
      path: '/'
    }
  });

  const providers = {
    client: apiClient(req),
    cookiesStorage
  };
  const history = createMemoryHistory({ initialEntries: [req.originalUrl] });
  const store = createStore({ history, helpers: providers, data: {} });

  function hydrate() {
    res.write('<!doctype html>');
    ReactDOM.renderToNodeStream(<Html assets={webpackIsomorphicTools.assets()} store={store} />).pipe(res);
  }

  if (__DISABLE_SSR__) {
    return hydrate();
  }

  try {
    const { components, match, params } = await asyncMatchRoutes(routes, req._parsedUrl.pathname);
    const locals = {
      ...providers,
      store,
      match,
      params,
      history,
      location: history.location
    };

    const restoreState = PersistServer({
      store,
      storage: cookiesStorage,
      modules: ['auth', 'cookieStorage']
    });
    const authorize = authorizeWait('authorized', components, locals);
    const triggers = triggerWait('fetch', components, locals);

    restoreState
      .then(() => authorize.then(() => triggers.then(() => {
        // Data fetched, state restored, lets render
        const modules = [];
        const context = {};
        const component = (
          <Loadable.Capture report={moduleName => modules.push(moduleName)}>
            <StaticRouter location={req.originalUrl} context={context}>
              <ReduxAsyncConnect routes={routes} store={store} helpers={providers}>
                {renderRoutes(routes)}
              </ReduxAsyncConnect>
            </StaticRouter>
          </Loadable.Capture>
        );
        const content = ReactDOM.renderToString(component);
        if (context.url) {
          console.log('REDIRECT', context);
          return res.redirect(301, context.url);
        }

        const bundles = getBundles(getChunks(), modules);
        const html = (
          <Html assets={webpackIsomorphicTools.assets()} bundles={bundles} content={content} store={store} />
        );
        res.status(200).send(`<!doctype html>${ReactDOM.renderToString(html)}`);
      })))
      .catch(error => {
        console.error('Mount error', error);
        res.status(404); // .send('There was a problem.');
        hydrate();
        // return res.redirect(301, '/404');
      });
  } catch (mountError) {
    console.error('MOUNT ERROR:', pretty.render(mountError));
    res.status(500);
    hydrate();
  }
});

(async () => {
  if (config.port) {
    try {
      await Loadable.preloadAll();
      await waitChunks(chunksPath);
    } catch (error) {
      console.log('Server preload error:', error);
    }

    server.listen(config.port, config.host, err => {
      if (err) {
        console.error(err);
      }
      console.info('----\n==> ✅  %s is running, talking to API server on %s.', config.app.title, config.apiPort);
      console.info('==> 💻  Open http://%s:%s in a browser to view the app.', config.host, config.port);
    });
  } else {
    console.error('==>     ERROR: No PORT environment variable has been specified');
  }
})();
