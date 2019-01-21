import axios from 'axios';
import config from '../config';

export default function apiClient(req) {
  const instance = axios.create({
    baseURL: __SERVER__ ? `http://${config.apiHost}:${config.apiPort}/api` : '/api'
  });

  instance.interceptors.request.use(
    conf => {
      if (__SERVER__) {
        if (req.cookies && req.cookies.get('token')) {
          conf.headers.authorization = `Bearer ${req.cookies.get('token')}`;
        }
        if (req.header('authorization')) {
          conf.headers.authorization = req.header('authorization');
        }
      }

      return conf;
    },
    error => Promise.reject(error)
  );

  instance.interceptors.response.use(
    response => response.data,
    error => Promise.reject(error.response ? error.response.data : error)
  );

  return instance;
}
