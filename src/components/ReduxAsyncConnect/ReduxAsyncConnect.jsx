/* eslint react/no-unused-state: "off" */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Route, withRouter } from 'react-router';
import { authorize, trigger } from '@slumdogjs/redial';
import NProgress from 'nprogress';
import asyncMap from '../../utils/asyncMap';
import asyncMatchRoutes from '../../utils/asyncMatchRoutes';

const Error = () => (
  <div>
    <h1>Error</h1>
    <p>Unfortunately there has been an irrecoverable error.</p>
    <p>So... well, yeah nothing we can do right now.</p>
  </div>
);


class ReduxAsyncConnect extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    history: PropTypes.objectOf(PropTypes.any).isRequired,
    routes: PropTypes.arrayOf(PropTypes.any).isRequired,
    store: PropTypes.objectOf(PropTypes.any).isRequired,
    helpers: PropTypes.objectOf(PropTypes.any).isRequired,
    location: PropTypes.objectOf(PropTypes.any).isRequired,
    errorPage: PropTypes.oneOfType([PropTypes.func, PropTypes.objectOf(PropTypes.any)]),
  };

  static defaultProps = {
    errorPage: null
  };

  constructor(props) {
    super(props);
    this.getAsyncData = this.getAsyncData.bind(this);
    this.state = {
      location: props.location,
      nextLocation: {
        pathname: '',
        search: ''
      },
      inTransition: false,
      authorized: true
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.location.pathname === state.nextLocation.pathname
      && props.location.search === state.nextLocation.search
    ) {
      return null;
    }

    if (props.location.pathname !== state.location.pathname
      || props.location.search !== state.location.search
    ) {
      return {
        nextLocation: Object.assign({}, props.location)
      };
    }
    return false;
  }

  componentDidMount() {
    const {
      history, location, routes, store, helpers
    } = this.props;
    this.getAsyncData(history, location, routes, store, helpers, false);
  }

  componentDidUpdate(prevProps, prevState) {
    const { inTransition, nextLocation: { pathname, search } } = this.state;
    if (inTransition === false) {
      if (prevState.nextLocation.pathname !== pathname
        || prevState.nextLocation.search !== search
      ) {
        const {
          history, location, routes, store, helpers
        } = this.props;
        this.getAsyncData(history, location, routes, store, helpers, false);
      }
    }
  }

  async getAsyncData(history, location, routes, store, helpers, isUpdate) {
    // save the location so we can render the old screen
    NProgress.start();
    this.setState({ inTransition: true });
    let authorized = false;
    // load data while the old screen remains
    const { components, match, params } = await asyncMatchRoutes(routes, location.pathname);
    await asyncMap(components, component => authorize('authorized', component, {
      ...helpers,
      store,
      match,
      params,
      history,
      location
    })).then(async () => {
      if (isUpdate === false) {
        const fetchers = async () => {
          await trigger('fetch', components, {
            ...helpers,
            store,
            match,
            params,
            history,
            location
          });
        };

        if (process.env.BUILD_TARGET === 'client') {
          trigger('defer', components, {
            ...helpers,
            store,
            match,
            params,
            history,
            location
          });
        }
        await fetchers();
      } else if (process.env.BUILD_TARGET === 'client') {
        trigger('defer', components, {
          ...helpers,
          store,
          match,
          params,
          history,
          location
        });
      }
      authorized = true;
      // this.setState({ authorized: true });
    }).catch(() => {
      authorized = true;
      // this.setState({ authorized: false });
    });

    // clear previousLocation so the next screen renders
    this.setState({ inTransition: false, location, authorized });
    NProgress.done();
  }

  render() {
    const { children, errorPage } = this.props;
    const { authorized, location } = this.state;

    if (authorized) {
      return (
        <Route
          location={location}
          render={() => children}
        />
      );
    }

    if (errorPage !== null) {
      const ErrorPage = errorPage;

      return (
        <Route
          location={location}
          render={() => <ErrorPage error="Not authorized" />}
        />
      );
    }

    return (
      <Route
        location={location}
        render={() => <Error />}
      />
    );
  }
}

export default withRouter(ReduxAsyncConnect);
