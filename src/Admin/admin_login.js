import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader } from 'lucide-react';

import { API_BASE_URL } from '../setup'; // Adjust path if needed

export default function AdminLogin() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    
    
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          rememberMe: formData.rememberMe
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Store authentication token
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminData', JSON.stringify(data.admin));
        
        // Redirect based on admin role
        if (data.admin.role === 'super_admin') {
          window.location.href = '/admin/super';
        } else if (data.admin.role === 'department_admin') {
          window.location.href = `/admin/department/${data.admin.department}`;
        } else if (data.admin.role === 'photo_admin') {
          window.location.href = '/admin/photo';
        }else if (data.admin.role === 'queue_admin') {
          window.location.href = '/admin/attendance';
        }
      } else {
        setError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to server. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleForgotPassword = () => {
    // Navigate to password reset page
    window.location.href = '/admin/forgot-password';
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <h1 className="text-base font-medium text-blue-900 leading-tight mb-4">
            Dummy University<br />
            Faculty of Engineering and Technology (FET)
          </h1>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Admin Login</h2>
          <p className="text-gray-600 text-sm">Access the administrative dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm text-center">
              <div className="flex items-center justify-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                    fieldErrors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="admin@college.edu"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-10 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                    fieldErrors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              {/* <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                Forgot password?
              </button> */}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full text-center justify-center items-center py-2 px-4 border border-transparent rounded text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              🏠 Home
            </button>
          </div>

          {/* Additional Info */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-2 font-medium">Demo Credentials:</p>
              <div className="space-y-1 text-xs text-gray-500 font-mono">
                <p><strong>Super Admin:</strong> super_admin / SUPER@2025!SecurePass</p>
                <p><strong>EC Admin:</strong> ec_admin / EC@2025!SecurePass</p>
                <p><strong>ME Admin:</strong> me_admin / ME@2025!SecurePass</p>
                <p><strong>CS Admin:</strong> cs_admin / CS@2025!SecurePass</p>
                <p><strong>Civil Admin:</strong> civil_admin / CE@2025!SecurePass</p>
                <p><strong>CH Admin:</strong> ch_admin / CH@2025!SecurePass</p>
                <p><strong>Photo Admin:</strong> photo_admin / PHOTO@2025!SecurePass</p>
                <p><strong>Queue Admin:</strong> queue_admin / QUEUE@2025!SecurePass</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-900">
            <p className="font-medium mb-1">Secure Access</p>
            <p>Admin portal for authorized personnel only. All activities are monitored and logged.</p>
          </div>
        </div>
      </div>
    </div>
  );
}