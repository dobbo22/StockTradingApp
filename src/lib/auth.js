// src/lib/auth.js
export const validateEmail = (email) => {
    return email.includes('@') && email.includes('.');
  };
  
  export const validatePassword = (password) => {
    return password.length >= 6;
  };
  
  export const loginUser = async (credentials) => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  };
  
  export const registerUser = async (userData) => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        throw new Error('Registration failed');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    }
  };
  
  // src/components/auth/LoginForm.jsx
  import React from 'react';
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Mail, Lock } from 'lucide-react';
  
  export const LoginForm = ({ onSubmit, onChange, formData, error }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="relative">
        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={onChange}
          className="pl-10"
        />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={onChange}
          className="pl-10"
        />
      </div>
      <Button type="submit" className="w-full">Login</Button>
    </form>
  );
  
  // src/components/auth/RegisterForm.jsx
  import React from 'react';
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Mail, Lock, User } from 'lucide-react';
  
  export const RegisterForm = ({ onSubmit, onChange, formData, error }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="relative">
        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={onChange}
          className="pl-10"
        />
      </div>
      <div className="relative">
        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={onChange}
          className="pl-10"
        />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={onChange}
          className="pl-10"
        />
      </div>
      <Button type="submit" className="w-full">Register</Button>
    </form>
  );
  
  // src/components/auth/AuthContainer.jsx
  import React, { useState } from 'react';
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./Components/ui/Card";
  import { Alert, AlertDescription } from "./Components/ui/Alert";
  import { Button } from "./Components/ui/Button";
  import { AlertCircle } from 'lucide-react';
  import { LoginForm } from './LoginForm';
  import { RegisterForm } from './RegisterForm';
  import { loginUser, registerUser, validateEmail, validatePassword } from './lib/auth';
  
  export const AuthContainer = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
      email: '',
      password: '',
      username: ''
    });
    const [error, setError] = useState('');
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      setError('');
  
      try {
        // Validate form data
        if (!formData.email || !formData.password || (!isLogin && !formData.username)) {
          throw new Error('Please fill in all fields');
        }
  
        if (!validateEmail(formData.email)) {
          throw new Error('Please enter a valid email address');
        }
  
        if (!validatePassword(formData.password)) {
          throw new Error('Password must be at least 6 characters long');
        }
  
        // Submit form
        const result = isLogin 
          ? await loginUser({ email: formData.email, password: formData.password })
          : await registerUser(formData);
  
        // Handle successful authentication
        console.log('Authentication successful:', result);
        
      } catch (err) {
        setError(err.message);
      }
    };
  
    const handleChange = (e) => {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value
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
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {isLogin ? (
              <LoginForm
                onSubmit={handleSubmit}
                onChange={handleChange}
                formData={formData}
                error={error}
              />
            ) : (
              <RegisterForm
                onSubmit={handleSubmit}
                onChange={handleChange}
                formData={formData}
                error={error}
              />
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm"
            >
              {isLogin 
                ? "Don't have an account? Register" 
                : "Already have an account? Login"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };
  
  export default AuthContainer;