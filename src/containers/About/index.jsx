import React from 'react';
import Loadable from 'react-loadable';

const ComponentLoadable = Loadable({
  loader: () => import('./About').then(module => module.default),
  loading: () => <div>Loading</div>
});

export default ComponentLoadable;
