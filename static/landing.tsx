/// <reference types="vite/client" />
import { hydrateRoot } from 'react-dom/client';
import App from './project-page';
import './landing.css';
hydrateRoot(
  document.getElementById('root')!,
  <App base={import.meta.env.BASE_URL} />,
);
