"use client";
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

export const getTours = async () => {
  const response = await api.get('/tours');
  return response.data;
};

export const getCarRentals = async () => {
  const response = await api.get('/car-rentals');
  return response.data;
};

export default api;
