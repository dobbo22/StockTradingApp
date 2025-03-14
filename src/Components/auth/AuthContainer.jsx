import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { Alert, AlertDescription } from "../ui/Alert";
import { Button } from "../ui/Button";
import { AlertCircle } from 'lucide-react';

export const AuthContainer = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    firstName: '',
    lastName: '',
    country: ''
  });
  const [error, setError] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // For registration, validate password confirmation
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    
    setPasswordMismatch(false);

    try {
      const apiEndpoint = isLogin ? 'login' : 'register';
      console.log(`Attempting ${isLogin ? 'login' : 'registration'} at: http://localhost:5001/api/${apiEndpoint}`);
      
      // Prepare data payload based on login or register
      const payload = isLogin 
        ? { 
            username: formData.username, 
            password: formData.password 
          }
        : {
            username: formData.username,
            password: formData.password,
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            country: formData.country || 'United Kingdom' // Default value
          };
      
      const response = await fetch(`http://localhost:5001/api/${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Authentication failed');
      }
      
      const data = await response.json();
      
      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);
      
      // Notify parent component of successful auth
      onAuthSuccess({ 
        userId: data.userId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        token: data.token
      });
    } catch (err) {
      console.error(`${isLogin ? 'Login' : 'Registration'} error:`, err);
      setError(err.message || 'Authentication failed');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear password mismatch error when user types in either password field
    if (name === 'password' || name === 'confirmPassword') {
      setPasswordMismatch(false);
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setPasswordMismatch(false);
    // Reset form data when switching modes
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      email: '',
      firstName: '',
      lastName: '',
      country: ''
    });
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? 'Login' : 'Register'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Welcome back! Please login to your account.' 
              : 'Create a new account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
                required
                placeholder="Enter your username"
              />
            </div>
            
            {/* Registration-only fields */}
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-md"
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full p-2 border rounded-md"
                      required
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full p-2 border rounded-md"
                      required
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Country</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Select your country</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Spain">Spain</option>
                    <option value="Italy">Italy</option>
                    <option value="Netherlands">Netherlands</option>
                    <option value="Sweden">Sweden</option>
                  </select>
                </div>
              </>
            )}
            
            {/* Password field */}
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
                required
                placeholder="Enter your password"
              />
            </div>
            
            {/* Confirm Password field (registration only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${passwordMismatch ? 'border-red-500' : ''}`}
                  required
                  placeholder="Confirm your password"
                />
                {passwordMismatch && (
                  <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                )}
              </div>
            )}
            
            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Submit button */}
            <Button type="submit" className="w-full">
              {isLogin ? 'Login' : 'Register'}
            </Button>
          </form>
          
          {/* Toggle between login and registration */}
          <Button
            variant="link"
            onClick={toggleAuthMode}
            className="w-full mt-4"
          >
            {isLogin 
              ? "Don't have an account? Register" 
              : "Already have an account? Login"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};