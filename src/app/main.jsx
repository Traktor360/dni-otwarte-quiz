// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Layout from '../components/Layout/Layout';
import Home from './Home/Home';
import Quiz from './Quiz/Quiz';
import Result from './Result/Result';
import Admin from './Admin/Admin';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="quiz/:resultId" element={<Quiz />} />
          <Route path="result/:resultId" element={<Result />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
      <Analytics />
    </BrowserRouter>
  </React.StrictMode>
);