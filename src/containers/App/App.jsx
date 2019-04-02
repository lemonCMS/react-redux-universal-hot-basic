import React from 'react';
import PropTypes from 'prop-types';
import { renderRoutes } from 'react-router-config';
import TopMenu from '../../components/TopMenu/ServerSide';

const App = props => {
  const { route } = props;
  return (
    <React.Fragment>
      <TopMenu />
      <h1>Welcome</h1>
      <p>This is a basic app</p>
      <div>
        {renderRoutes(route.routes)}
      </div>
    </React.Fragment>
  );
};

App.propTypes = {
  route: PropTypes.shape({
    routes: PropTypes.array
  }).isRequired
};

export default App;
