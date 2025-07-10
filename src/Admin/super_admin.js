import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit, Shield, Users, Search, AlertCircle, CheckCircle, X, Key, Mail, User, Building, LogOut, Eye, EyeOff } from 'lucide-react';

import { API_BASE_URL } from '../setup'; // Adjust path if needed



// Notification Component (also moved outside)
const NotificationBar = ({ message, type }) => {
  if (!message) return null;

  const getNotificationClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-400 text-green-700';
      case 'error':
        return 'bg-red-100 border-red-400 text-red-700';
      default:
        return 'bg-blue-100 border-blue-400 text-blue-700';
    }
  };

  return (
    <div className={`border-l-4 p-4 mb-6 rounded ${getNotificationClasses()}`}>
      <p className="font-medium">{message}</p>
    </div>
  );
};

export default function SuperAdminPage() {
  const [admins, setAdmins] = useState([]);
  const [filteredAdmins, setFilteredAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [departments, setDepartments] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [stats, setStats] = useState({
    totalAdmins: 0,
    superAdmins: 0,
    departmentAdmins: 0,
    photoAdmins: 0
  });
  
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'department_admin',
    department: '',
    permissions: []
  });
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const adminRoles = [
    { value: 'super_admin', label: 'Super Admin', color: 'red', icon: '👑' },
    { value: 'department_admin', label: 'Department Admin', color: 'blue', icon: '🏢' },
    { value: 'photo_admin', label: 'Photo Admin', color: 'purple', icon: '📸' }
  ];

  const permissions = [
    { id: 'view_students', label: 'View Students' },
    { id: 'edit_students', label: 'Edit Students' },
    { id: 'verify_documents', label: 'Verify Documents' },
    { id: 'manage_photos', label: 'Manage Photos' },
    { id: 'export_data', label: 'Export Data' },
    { id: 'view_reports', label: 'View Reports' }
  ];

  const allDepartments = [
    'Computer Science',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Electronics & Communication',
    'Information Technology',
    'Chemical Engineering',
    'Biotechnology'
  ];

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const adminData = localStorage.getItem('adminData');
    
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    
    try {
      const parsedAdminData = JSON.parse(adminData);
      
      // Check if user is super admin
      if (parsedAdminData.role !== 'super_admin') {
        showNotification('Access denied. Super admin privileges required.', 'error');
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
        return;
      }
      
      setCurrentAdmin(parsedAdminData);
      setIsAuthenticated(true);
      loadAdmins();
      loadStats();
    } catch (error) {
      console.error('Invalid admin data:', error);
      handleLogout();
    }
  }, []);

  // Filter admins based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAdmins(admins);
    } else {
      const filtered = admins.filter(admin =>
        admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAdmins(filtered);
    }
  }, [searchQuery, admins]);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    window.location.href = '/admin/login';
  };

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/admins`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAdmins(data.admins);
        setFilteredAdmins(data.admins);
      } else {
        showNotification('Failed to load admins', 'error');
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      showNotification('Unable to connect to server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/admins/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!newAdmin.name.trim()) {
      errors.name = 'Name is required';
    }
    

    
    if (!newAdmin.password) {
      errors.password = 'Password is required';
    } else if (newAdmin.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (newAdmin.password !== newAdmin.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (newAdmin.role === 'department_admin' && !newAdmin.department) {
      errors.department = 'Department is required for department admins';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddAdmin = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      const token = localStorage.getItem('adminToken');
      const adminData = {
        name: newAdmin.name,
        email: newAdmin.email,
        password: newAdmin.password,
        role: newAdmin.role,
        department: newAdmin.role === 'department_admin' ? newAdmin.department : null,
        permissions: newAdmin.permissions,
        createdBy: currentAdmin.email
      };
      
      const response = await fetch(`${API_BASE_URL}/api/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adminData)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showNotification('Admin added successfully! ✅', 'success');
        setShowAddModal(false);
        resetForm();
        loadAdmins();
        loadStats();
      } else {
        showNotification(data.error || 'Failed to add admin', 'error');
      }
    } catch (error) {
      console.error('Error adding admin:', error);
      showNotification('Failed to add admin', 'error');
    }
  };

  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/admins/${adminToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showNotification('Admin deleted successfully! 🗑️', 'success');
        setShowDeleteModal(false);
        setAdminToDelete(null);
        loadAdmins();
        loadStats();
      } else {
        showNotification(data.error || 'Failed to delete admin', 'error');
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      showNotification('Failed to delete admin', 'error');
    }
  };

  const resetForm = () => {
    setNewAdmin({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'department_admin',
      department: '',
      permissions: []
    });
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handlePermissionToggle = (permissionId) => {
    setNewAdmin(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'department_admin':
        return 'bg-blue-100 text-blue-800';
      case 'photo_admin':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Add Admin Modal
// Replace your AddAdminModal component with this fixed version:

// Replace your AddAdminModal component with this fixed version:

const AddAdminModal = ({ showAddModal, setShowAddModal, newAdmin, setNewAdmin }) => {
  if (!showAddModal) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewAdmin(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Add New Admin</h2>
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="text-white hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="name"
                value={newAdmin.name}
                onChange={handleChange}
                className={`pl-10 w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="John Doe"
              />
            </div>
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="email"
                value={newAdmin.email}
                onChange={handleChange}
                className={`pl-10 w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="admin@college.edu"
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={newAdmin.password}
                onChange={handleChange}
                className={`pl-10 pr-10 w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={newAdmin.confirmPassword}
                onChange={handleChange}
                className={`pl-10 pr-10 w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Role
            </label>
            <div className="space-y-2">
              {adminRoles.map(role => (
                <label key={role.value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={newAdmin.role === role.value}
                    onChange={handleChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-3 flex items-center">
                    <span className="text-2xl mr-2">{role.icon}</span>
                    <span className="font-medium">{role.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Department Selection (for department admins) */}
          {newAdmin.role === 'department_admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <select
                  name="department"
                  value={newAdmin.department}
                  onChange={handleChange}
                  className={`pl-10 w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.department ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select Department</option>
                  {allDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              {fieldErrors.department && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.department}</p>
              )}
            </div>
          )}


          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAdmin}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Add Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

  // Delete Confirmation Modal
  const DeleteModal = () => {
    if (!showDeleteModal || !adminToDelete) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full">
          <div className="p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-center mb-2">Delete Admin</h3>
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to delete <strong>{adminToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAdminToDelete(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAdmin}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Notification Component
  const NotificationBar = ({ message, type }) => {
    if (!message) return null;

    const getNotificationClasses = () => {
      switch (type) {
        case 'success':
          return 'bg-green-100 border-green-400 text-green-700';
        case 'error':
          return 'bg-red-100 border-red-400 text-red-700';
        default:
          return 'bg-blue-100 border-blue-400 text-blue-700';
      }
    };

    return (
      <div className={`border-l-4 p-4 mb-6 rounded ${getNotificationClasses()}`}>
        <p className="font-medium">{message}</p>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2">Super Admin Dashboard</h1>
                <p className="text-indigo-100">Manage system administrators</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-indigo-200">Logged in as:</p>
                <p className="font-medium">{currentAdmin?.name}</p>
                <button
                  onClick={handleLogout}
                  className="mt-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <NotificationBar message={notification.message} type={notification.type} />

            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl">
                <h3 className="text-lg font-medium mb-2">Total Admins</h3>
                <p className="text-3xl font-bold">{stats.totalAdmins}</p>
              </div>
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl">
                <h3 className="text-lg font-medium mb-2">Super Admins</h3>
                <p className="text-3xl font-bold">{stats.superAdmins}</p>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl">
                <h3 className="text-lg font-medium mb-2">Dept Admins</h3>
                <p className="text-3xl font-bold">{stats.departmentAdmins}</p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl">
                <h3 className="text-lg font-medium mb-2">Photo Admins</h3>
                <p className="text-3xl font-bold">{stats.photoAdmins}</p>
              </div>
            </div>

            {/* Search and Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Add Admin
              </button>
            </div>
          </div>
        </div>

        {/* Admins Table */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent mr-2"></div>
                        Loading admins...
                      </div>
                    </td>
                  </tr>
                ) : filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? 'No admins found matching your search.' : 'No admins found.'}
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => (
                    <tr key={admin._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{admin.name}</div>
                            <div className="text-sm text-gray-500">{admin.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          admin.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          
                          <button
                            onClick={() => {
                              if (admin.email === currentAdmin.email) {
                                showNotification('You cannot delete your own account', 'error');
                                return;
                              }
                              setAdminToDelete(admin);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Admin"
                            disabled={admin.email === currentAdmin.email}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-indigo-50 border border-indigo-200 p-6 rounded-xl">
          <h3 className="font-semibold text-indigo-800 mb-3">📋 Admin Management Guidelines</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-indigo-700">
            <div>
              <h4 className="font-medium mb-2">Admin Roles:</h4>
              <ul className="space-y-1">
                <li>• <strong>Super Admin:</strong> Full system access, can manage all admins</li>
                <li>• <strong>Department Admin:</strong> Manages students in assigned department</li>
                <li>• <strong>Photo Admin:</strong> Handles student photo verification</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Important Notes:</h4>
              <ul className="space-y-1">
                <li>• Admins receive login credentials via email</li>
                <li>• Passwords must be at least 8 characters long</li>
                <li>• You cannot delete your own admin account</li>
                <li>• All admin actions are logged for security</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AddAdminModal
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        newAdmin={newAdmin}
        setNewAdmin={setNewAdmin}
        />

      <DeleteModal />
    </div>
  );
}