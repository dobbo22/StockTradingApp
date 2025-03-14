import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StockTradingApp from './StockTradingApp.jsx';
import { AuthContainer } from './Components/auth/AuthContainer.jsx';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);

  // Check for existing authentication on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');

    if (storedToken && storedUserId) {
      setIsLoggedIn(true);
      setUserId(storedUserId);
      setToken(storedToken);
    }
  }, []);

  const handleAuthSuccess = (userData) => {
    console.log('Auth Success:', userData);
    setIsLoggedIn(true);
    setUserId(userData.userId);
    setToken(userData.token);
  };

  const handleLogout = () => {
    console.log('Logging out');
    
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');

    // Clear state
    setIsLoggedIn(false);
    setUserId(null);
    setToken(null);
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/auth" 
          element={
            !isLoggedIn ? (
              <AuthContainer onAuthSuccess={handleAuthSuccess} />
            ) : (
              <Navigate to="/dashboard" />
            )
          } 
        />

        <Route
          path="/dashboard/*"
          element={
            isLoggedIn ? (
              <StockTradingApp 
                initialUserId={userId}
                isAuthenticated={isLoggedIn}
                token={token}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/auth" />
            )
          }
        />

        <Route
          path="/"
          element={<Navigate to={isLoggedIn ? "/dashboard" : "/auth"} />}
        />
      </Routes>
    </Router>
  );
}

export default App;