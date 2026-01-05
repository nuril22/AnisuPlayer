// API Configuration - use relative URLs to work with Vite proxy
// In development, Vite will proxy /api requests to the backend server

const isDevelopment = import.meta.env.DEV;
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

// Always use relative URLs - Vite proxy handles development routing
export const API_URL = '';

export const isVercelDeployment = isVercel;
export const isDev = isDevelopment;
