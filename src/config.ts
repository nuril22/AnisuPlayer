// API Configuration - use relative URLs to work with Vite proxy
// In development, Vite will proxy /api requests to the backend server

const isDevelopment = import.meta.env.DEV;
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

// In development, use full backend URL for /cdn API calls to avoid proxy conflict with React Router
// In production, use relative URLs
export const API_URL = isDevelopment ? 'http://localhost:3001' : '';

export const isVercelDeployment = isVercel;
export const isDev = isDevelopment;
