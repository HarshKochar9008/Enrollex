import React, { useState, useEffect } from 'react';
import { Users, Clock, Phone, Mail, Calendar, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from './setup'; // Adjust path if needed

const StudentQueueDashboard = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch students from Flask backend
const fetchStudents = async () => {
  try {
    setLoading(true);
    setError(null);

    const response = await fetch(`${API_BASE_URL}/api/students`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Backend returned non-JSON response');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Fetched students:', data);

    if (!Array.isArray(data.students)) {
      throw new Error('Invalid data format: expected "students" array');
    }

    const validStudents = data.students.filter(student =>
      student &&
      typeof student === 'object' &&
      student.studentId &&
      student.name &&
      student.department
    );

    if (validStudents.length !== data.students.length) {
      console.warn(`Filtered out ${data.students.length - validStudents.length} invalid student records`);
    }

    setStudents(validStudents);
    console.log(`Successfully loaded ${validStudents.length} students from backend`);

  } catch (err) {
    console.error('Backend error:', err.message);

    if (err.name === 'TimeoutError') {
      setError('Backend connection timeout');
    } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      setError('Cannot connect to backend server');
    } else {
      setError(`Backend error: ${err.message}`);
    }

    setStudents([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchStudents();
    const interval = setInterval(fetchStudents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleRefresh = () => {
    fetchStudents();
  };

  // Group students by department and filter out verified students
  const groupedStudents = students.reduce((acc, student) => {
    const dept = student.department || 'Unknown';
    
    // Only include students who are not verified (they're still in queue)
    console.log(student)
    if (student.attendance !== 'absent' && student.status !== 'verified') {
      if (!acc[dept]) {
        acc[dept] = [];
      }
      acc[dept].push(student);
    }
    
    return acc;
  }, {});

  // Sort students within each department by registration date (queue order)
  Object.keys(groupedStudents).forEach(dept => {
    groupedStudents[dept].sort((a, b) => 
      new Date(a.registrationDate) - new Date(b.registrationDate)
    );
  });

  const departments = Object.keys(groupedStudents);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'photo_uploaded':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'active':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'verified':
        return 'bg-gray-50 border-gray-200 text-gray-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'photo_uploaded':
        return 'Photo Uploaded';
      case 'active':
        return 'Active';
      case 'verified':
        return 'Verified';
      default:
        return status?.replace('_', ' ').toUpperCase() || 'Unknown';
    }
  };

  // Get total students in all queues
  const totalInQueue = Object.values(groupedStudents).reduce((total, deptStudents) => total + deptStudents.length, 0);

  // Don't show error screen if we have students
  if (error && students.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2 text-sm">Cannot Connect to Backend</h3>
          <p className="text-red-600 mb-4 text-sm">{error}</p>
          <p className="text-xs text-gray-600 mb-4">
            Make sure your Flask backend is running at: <code className="bg-gray-100 px-1 rounded text-xs">{API_BASE_URL}</code>
          </p>
          <button 
            onClick={fetchStudents}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src="Enrollex.png" // Replace with actual logo path
              alt="Dummy UniversityLogo"
              className="w-20 h-20 object-contain mr-6"
            />
            <div className="text-left">
              <h1 className="text-base font-medium text-blue-900 leading-tight">
                Dummy University<br />
                Faculty of Engineering and Technology (FET)
              </h1>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Student Queue Dashboard</h2>
          <p className="text-gray-600 text-sm">Next 3 students in queue by department</p>
        </div>

        {/* Status Bar */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Users className="w-4 h-4" />
                <span>Total in queue: <strong>{totalInQueue}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {error && ( 
                <>
                  <div className="bg-red-50 border border-red-200 text-red-800 px-2 py-1 rounded text-xs">
                    Connection Error
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="bg-blue-900 hover:bg-blue-800 text-white px-3 py-1 rounded text-xs"
                  >
                    Retry
                  </button>
                </>
              )}
              {!error && students.length > 0 && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-2 py-1 rounded text-xs">
                  Backend Connected
                </div>
              )}
              <button
                onClick={handleRefresh}
                className="bg-blue-900 hover:bg-blue-800 text-white px-3 py-1 rounded text-xs"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>

        {departments.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 mb-2">No Students in Queue</h3>
            <p className="text-gray-600 text-sm">All students have been verified or there are no pending registrations.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {departments.map((department) => {
              const deptStudents = groupedStudents[department];
              const queueLength = deptStudents.length;
              const topThree = deptStudents.slice(0, 3); // Get first 3 students

              return (
                <div key={department} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  {/* Department Header */}
                  <div className="bg-blue-900 text-white p-4">
                    <h3 className="text-base font-semibold">{department}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{queueLength} in queue</span>
                    </div>
                  </div>

                  {/* Top 3 Students in Queue */}
                  <div className="p-4">
                    {topThree.length > 0 ? (
                      <div className="space-y-4">
                        {topThree.map((student, index) => (
                          <div 
                            key={student.studentId} 
                            className={`border rounded-lg p-3 ${
                              index === 0 
                                ? 'border-green-200 bg-green-50' 
                                : index === 1 
                                ? 'border-blue-200 bg-blue-50' 
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                index === 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : index === 1 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                #{index + 1} in Queue
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(student.status)}`}>
                                {getStatusLabel(student.status)}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {student.name}
                                </h4>
                                <p className="text-xs text-gray-600">
                                  ID: {student.studentId}
                                </p>
                                {student.applicationNumber && (
                                  <p className="text-xs text-gray-600">
                                    App #: {student.applicationNumber}
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1">
                                {student.email && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{student.email}</span>
                                  </div>
                                )}
                                {student.phone && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span>{student.phone}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span>Registered: {formatDate(student.registrationDate)}</span>
                                </div>
                                <div className="text-xs text-gray-600 ml-5">
                                  <span>Time: {formatTime(student.registrationDate)}</span>
                                </div>
                              </div>

                              {/* Show parent info only for first student */}
                              {index === 0 && student.parentName && (
                                <div className="mt-2 p-2 bg-white border border-gray-200 rounded">
                                  <p className="text-xs font-medium text-gray-700">Parent/Guardian</p>
                                  <p className="text-xs text-gray-600">{student.parentName}</p>
                                  {student.parentPhone && (
                                    <p className="text-xs text-gray-600">{student.parentPhone}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {queueLength > 3 && (
                          <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                            <p className="text-xs text-gray-600">
                              + {queueLength - 3} more student{queueLength > 4 ? 's' : ''} waiting
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm font-medium">Queue Clear!</p>
                        <p className="text-gray-500 text-xs">All students verified</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Queue Statistics */}
        {departments.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-900">{departments.length}</div>
              <div className="text-xs text-gray-600">Departments</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{totalInQueue}</div>
              <div className="text-xs text-gray-600">Total in Queue</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {students.filter(s => s.status === 'photo_uploaded').length}
              </div>
              <div className="text-xs text-gray-600">Photo Uploaded</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {students.filter(s => s.status === 'verified').length}
              </div>
              <div className="text-xs text-gray-600">Verified Today</div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="text-center">
            <p className="text-blue-900 font-medium text-sm mb-1">Real-time Queue Management</p>
            <p className="text-blue-800 text-xs">
              This dashboard automatically refreshes every 5 seconds. Students are shown in order of registration time. 
              Verified students are automatically removed from the queue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQueueDashboard;