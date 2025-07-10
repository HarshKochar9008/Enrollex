import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  
  const departments = [
    'Computer Science',
    'Electronics', 
    'Mechanical',
    'Civil',
    'Chemical'
  ];

  // Helper function for navigation
  const navigateTo = (path) => {
    navigate(path);
  };

  // Helper function to format department name for URL
  const formatDeptForUrl = (deptName) => {
    return deptName.replace(/\s+/g, '').toLowerCase();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">College Registration System</h1>
          <p className="text-lg text-gray-600">Welcome to the student registration and management portal</p>
        </div>

        {/* Student Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">For Students</h2>
          <p className="text-gray-600 mb-4">New students can register here and check their status.</p>
          <div className="flex gap-4 flex-wrap">
            <button 
              onClick={() => navigateTo('/')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              📝 New Student Registration
            </button>
          </div>
        </div>

        {/* Photo Admin Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">Photo Room</h2>
          <p className="text-gray-600 mb-4">For photo admin to capture student photos and generate application numbers</p>
          <div className="flex gap-4 flex-wrap">
            <button 
              onClick={() => navigateTo('/admin/photo')}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              📸 Photo Room Interface
            </button>
          </div>
        </div>

        {/* Department Admin Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">Department Admin</h2>
          <p className="text-gray-600 mb-4">For department admins to view and verify student documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => navigateTo(`/admin/department/${formatDeptForUrl(dept)}`)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg font-medium transition-colors duration-200 text-center flex items-center justify-center gap-2 text-sm"
              >
                🏛️ {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Admin Login */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">System Access</h2>
          <p className="text-gray-600 mb-4">Administrative login for photo room and department access</p>
          <div className="flex gap-4 flex-wrap">
            <button 
              onClick={() => navigateTo('/admin/login')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              🔐 Admin Login
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-50 rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">System Workflow</h3>
          <ol className="space-y-3 text-gray-700 leading-relaxed pl-6">
            <li className="list-decimal">
              <strong className="text-gray-800">Student Registration:</strong> Student fills the registration form and gets a Student ID
            </li>
            <li className="list-decimal">
              <strong className="text-gray-800">Photo Capture:</strong> Student visits photo room, admin takes photo and generates Application Number
            </li>
            <li className="list-decimal">
              <strong className="text-gray-800">Document Verification:</strong> Student meets department admin who verifies submitted documents
            </li>
            <li className="list-decimal">
              <strong className="text-gray-800">Completion:</strong> Once all documents are verified, registration process is complete
            </li>
          </ol>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-medium">💡</span>
              <div>
                <strong className="text-blue-800">Performance Note:</strong>
                <span className="text-blue-700 text-sm ml-2">
                  This system is optimized to reduce server costs. 
                  Pages load only when you click on them, ensuring fast and efficient operation.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}