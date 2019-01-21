import React from 'react';
import Loadable from 'react-loadable';

const HomeLoadable = Loadable({
  loader: () => import('./Home').then(module => module.default),
  loading: () => <div>Loading</div>
});

export default HomeLoadable;
