import { useState, useEffect } from 'react';

// You need to define your API_BASE_URL - replace this with your actual backend URL
import { API_BASE_URL } from '../setup'; // Adjust path if needed

export default function AttendanceAdminPage() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading = true
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [markingAttendance, setMarkingAttendance] = useState({});
  const [adminData, setAdminData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);


  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const storedAdminData = localStorage.getItem('adminData');
    
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    
    try {
      const parsedAdminData = JSON.parse(storedAdminData);
      setAdminData(parsedAdminData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Invalid admin data:', error);
      handleLogout();
    }
  }, []);

  useEffect(() => {
    const expiresAt = localStorage.getItem('adminTokenExpiry');
    if (expiresAt) {
      const msLeft = parseInt(expiresAt) - Date.now();
      console.log(`Token expires in ${Math.round(msLeft / 1000)} seconds`);

      const timeout = setTimeout(() => {
        handleLogout();
      }, msLeft);

      return () => clearTimeout(timeout);
    }
  }, []);
  // Load students on mount
  useEffect(() => {
    loadStudents();
  }, []);

  // Filter students based on search query - always run after students are loaded
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students); // Show all students when no search query
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.juApplication && student.juApplication.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (student.phone && student.phone.includes(searchQuery)) ||
        (student.department && student.department.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    window.location.href = '/admin/login';
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/students`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStudents(data.students);
        // If no search query, show all students; otherwise filter immediately
        if (!searchQuery.trim()) {
          setFilteredStudents(data.students);
        } else {
          // Apply current search filter to the new data
          const filtered = data.students.filter(student =>
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.juApplication && student.juApplication.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (student.phone && student.phone.includes(searchQuery)) ||
            (student.department && student.department.toLowerCase().includes(searchQuery.toLowerCase()))
          );
          setFilteredStudents(filtered);
        }
      } else {
        showNotification('Failed to load students', 'error');
      }
    } catch (error) {
      console.error('Error loading students:', error);
      showNotification('Unable to connect to server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const markPresent = async (studentId, studentName, department) => {
    setMarkingAttendance(prev => ({ ...prev, [studentId]: true }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/mark`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          studentId,
          department,
          status: 'present',
          timestamp: new Date().toISOString()
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showNotification(`${studentName} marked present! ✅`, 'success');
        // Clear search to show next student
        setSearchQuery('');
        setTimeout(() => {
          window.location.reload();
        }, 0); // Give time for user to see the success message
      } else {
        showNotification(data.message || 'Failed to mark attendance', 'error');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      showNotification('Failed to mark attendance. Please try again.', 'error');
    } finally {
      setMarkingAttendance(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // Notification Component
  const NotificationBar = ({ message, type }) => {
    if (!message) return null;

    const getNotificationClasses = () => {
      switch (type) {
        case 'success':
          return 'bg-green-50 border border-green-200 text-green-800';
        case 'error':
          return 'bg-red-50 border border-red-200 text-red-800';
        case 'info':
          return 'bg-blue-50 border border-blue-200 text-blue-800';
        default:
          return 'bg-blue-50 border border-blue-200 text-blue-800';
      }
    };

    return (
      <div className={`p-3 rounded-lg mb-4 text-sm text-center ${getNotificationClasses()}`}>
        <p className="font-medium">{message}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-base font-medium text-blue-900 leading-tight">
            Dummy University<br />
            Faculty of Engineering and Technology (FET)
          </h1>
          <h2 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Attendance Admin Dashboard</h2>
          <p className="text-gray-600 text-sm">Mark student attendance</p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <NotificationBar message={notification.message} type={notification.type} />

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Total Students</p>
              <p className="text-xl font-semibold text-gray-900">{students.length}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Search Results</p>
              <p className="text-xl font-semibold text-gray-900">{filteredStudents.length}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Present Today</p>
              <p className="text-xl font-semibold text-green-600">
                {students.filter(s => s.attendance === 'present').length}
              </p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Absent</p>
              <p className="text-xl font-semibold text-red-600">
                {students.filter(s => s.attendance === 'absent').length}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, student ID, JU application, phone, or department... (leave empty to show all)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
                autoFocus
              />
            </div>
            <button
              onClick={loadStudents}
              disabled={loading}
              className="bg-blue-900 hover:bg-blue-800 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? '🔄' : '↻'} Refresh
            </button>
          </div>
        </div>

        {/* Students List */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">
              {searchQuery.trim() ? `Search Results (${filteredStudents.length})` : `All Students (${filteredStudents.length})`}
            </h3>
          </div>
            
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                    Loading students...
                  </div>
                </div>
              ) : students.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No students found. Please check your backend connection.
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No students found matching your search.
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div key={student.studentId} className="px-4 py-4 hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-base font-medium text-gray-900 mb-1 flex items-center gap-2">
                        {student.name}
                        {student.attendance === 'present' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Already Present
                          </span>
                        )}
                        {student.status === 'verified' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {student.email}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        ID: {student.studentId} • JU: {student.juApplication}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {student.department} • Phone: {student.phone}
                      </div>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => markPresent(student.studentId, student.name, student.department)}
                        disabled={markingAttendance[student.studentId] || student.attendance === 'present'}
                        className={`px-6 py-2 rounded-lg text-sm font-medium min-w-[100px] ${
                          student.attendance === 'present' 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white'
                        }`}
                      >
                        {markingAttendance[student.studentId] ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2"></div>
                            Marking...
                          </>
                        ) : student.attendance === 'present' ? (
                          '✅ Already Present'
                        ) : (
                          '✅ Mark Present'
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        

        {/* Instructions - only show when no students from backend */}
        {!loading && students.length === 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 p-6 rounded-lg text-center">
            <div className="text-blue-900 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-blue-900 mb-2">No Students Found</h3>
            <p className="text-blue-800 text-sm">
              No students available. Please check your backend connection and try refreshing.
            </p>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-6 bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">📋 How to Use</h3>
          <div className="text-xs text-gray-700 space-y-2">
            <p>• <strong>View All:</strong> Leave search box empty to see all students</p>
            <p>• <strong>Search:</strong> Type student name, email, ID, JU application, phone, or department to filter</p>
            <p>• <strong>Mark Present:</strong> Click the "✅ Present" button next to the student's name</p>
            <p>• <strong>Quick Process:</strong> After marking, search clears automatically for the next student</p>
            <p>• <strong>Confirmation:</strong> Green notification confirms successful attendance marking</p>
          </div>
        </div>
      </div>
    </div>
  );
}