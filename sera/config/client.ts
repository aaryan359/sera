


import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api';

//for creating instance of axios. makes a default prefix for each api request
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

//setting up header, making sure for authenticated api calls through token checking
apiClient.interceptors.request.use(
  async config => {
     const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

export default apiClient;