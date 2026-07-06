import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  const dashboard = user?.role === 'admin' ? <AdminDashboard /> : <MemberDashboard />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={user ? dashboard : <LandingPage />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/*"
          element={user ? dashboard : <Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
