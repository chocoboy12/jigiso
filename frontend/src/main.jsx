import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1A1A2E',
            color: '#fff',
            borderRadius: '12px',
            border: '1px solid rgba(200, 148, 26, 0.3)',
          },
          success: {
            iconTheme: { primary: '#009A00', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#C41E3A', secondary: '#fff' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
