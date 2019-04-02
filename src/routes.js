import React from 'react';
import App from 'containers/App/App';
import Home from 'containers/Home/Loadable';
import About from 'containers/About';

const routes = [
  {
    component: App,
    routes: [
      { path: '/', component: Home, exact: true },
      { path: '/about', component: About, exact: true },
      { component: () => <div>404</div> }
    ]
  }
];

export default routes;
