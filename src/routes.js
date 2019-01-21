import App from 'containers/App/App';
import Home from 'containers/Home/Loadable';

const routes = [
  {
    component: App,
    routes: [{ path: '/', component: Home }]
  }
];

export default routes;
