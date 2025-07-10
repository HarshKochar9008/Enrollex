import { useState, useEffect, useRef } from 'react';

import { API_BASE_URL } from '../setup'; // Adjust path if needed

export default function PhotoAdminPage() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [photoStats, setPhotoStats] = useState({
    pending: 0,
    completedToday: 0,
    totalCompleted: 0
  });
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check authentication on mount
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
      loadPendingStudents();
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


  // Filter students based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.department.toLowerCase().includes(searchQuery.toLowerCase())
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

  const calculatePhotoStats = (allStudents, pendingStudents) => {
    const today = new Date().toDateString();
    
    // Calculate completed today (students with photo_taken status and today's date)
    const completedToday = allStudents.filter(student => {
      const isPhotoTaken = student.status === 'photo_taken' || student.status === 'photo_uploaded';
      const isToday = student.photoTakenDate ? 
        new Date(student.photoTakenDate).toDateString() === today :
        student.updatedAt ? new Date(student.updatedAt).toDateString() === today : false;
      return isPhotoTaken && isToday;
    }).length;

    // Calculate total completed (all students with photo_taken status)
    const totalCompleted = allStudents.filter(student => 
      student.status === 'photo_taken' || student.status === 'photo_uploaded'
    ).length;

    setPhotoStats({
      pending: pendingStudents.length,
      completedToday,
      totalCompleted
    });
  };

  const loadPendingStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/students`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      if (response.ok && data.success) {
        const allStudents = data.students; // Keep all students for stats calculation
        
        // Filter for students who need photo verification
        const pendingPhotos = allStudents.filter(student => 
          student.status === 'pending'
          && student.attendance === 'present'
        );
        
        setStudents(pendingPhotos);
        setFilteredStudents(pendingPhotos);
        
        // Calculate stats from all students data
        calculatePhotoStats(allStudents, pendingPhotos);
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      showNotification('Unable to access camera. Please check permissions.', 'error');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
    setCapturedPhoto(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoDataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedPhoto(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      showNotification('Please select a valid image file', 'error');
    }
  };

  const uploadPhoto = async () => {
    if (!capturedPhoto || !selectedStudent) return;

    setUploadingPhoto(true);
    
    try {
      // Convert data URL to blob
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('photo', blob, `${selectedStudent.studentId}.jpg`);
      formData.append('studentId', selectedStudent.studentId);

      const token = localStorage.getItem('adminToken');
      // Upload photo
      const uploadResponse = await fetch(`${API_BASE_URL}/api/students/upload-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (uploadResponse.status === 401) {
        handleLogout();
        return;
      }

      if (uploadResponse.ok) {
        // Update student status
        await updateStudentStatus(selectedStudent.studentId, 'photo_taken');
        showNotification('Photo uploaded successfully! 📸', 'success');
        setCapturedPhoto(null);
        setSelectedStudent(null);
        loadPendingStudents(); // Refresh the list
      } else {
        showNotification('Failed to upload photo', 'error');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      showNotification('Upload failed. Please try again.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateStudentStatus = async (studentId, status) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const markPhotoComplete = async (studentId) => {
    try {
      await updateStudentStatus(studentId, 'photo_taken');
      showNotification('Student marked as photo completed! ✅', 'success');
      loadPendingStudents();
    } catch (error) {
      showNotification('Failed to update status', 'error');
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

  // Camera Modal Component
  const CameraModal = () => {
    if (!showCamera && !capturedPhoto) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {showCamera ? 'Take Photo' : 'Photo Preview'}
            </h3>
            <button
              onClick={() => {
                stopCamera();
                setCapturedPhoto(null);
                setSelectedStudent(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedStudent && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-gray-900">Taking photo for:</p>
              <p className="text-sm text-gray-600">
                {selectedStudent.name} ({selectedStudent.studentId})
              </p>
            </div>
          )}

          <div className="text-center">
            {showCamera && (
              <div className="mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-w-md mx-auto rounded-lg border border-gray-200"
                />
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    onClick={capturePhoto}
                    className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    📸 Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {capturedPhoto && (
              <div className="mb-4">
                <img
                  src={capturedPhoto}
                  alt="Captured"
                  className="w-full max-w-md mx-auto rounded-lg border border-gray-200"
                />
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={uploadPhoto}
                    disabled={uploadingPhoto}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    {uploadingPhoto ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      '✅ Upload Photo'
                    )}
                  </button>
                  <button
                    onClick={() => setCapturedPhoto(null)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    🔄 Retake
                  </button>
                  <button
                    onClick={startCamera}
                    className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    📸 Take Another
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <h1 className="text-base font-medium text-blue-900 leading-tight">
          Dummy University
          </h1>
          <h2 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Photo Admin Dashboard</h2>
          <p className="text-gray-600 text-sm">Manage student photo verification</p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <NotificationBar message={notification.message} type={notification.type} />

          {/* Stats Cards */}
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Pending Photos</p>
              <p className="text-xl font-semibold text-gray-900">{photoStats.pending}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Completed Today</p>
              <p className="text-xl font-semibold text-gray-900">{photoStats.completedToday}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Total Completed</p>
              <p className="text-xl font-semibold text-gray-900">{photoStats.totalCompleted}</p>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, student ID, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadPendingStudents}
                disabled={loading}
                className="bg-blue-900 hover:bg-blue-800 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {loading ? '🔄' : '↻'} Refresh
              </button>
              <button
                onClick={handleLogout}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Logout
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                        Loading students...
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500 text-sm">
                      {searchQuery ? 'No students found matching your search.' : 'No pending photo verifications.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.studentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-500">{student.email}</div>
                          <div className="text-xs text-gray-400 font-mono">{student.studentId}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {student.department}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-white text-xs font-medium ${
                          student.status === 'pending' 
                            ? 'bg-amber-500' 
                            : 'bg-blue-900'
                        }`}>
                          {student.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(student.registrationDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              startCamera();
                            }}
                            className="bg-blue-900 hover:bg-blue-800 text-white px-2 py-1 rounded text-xs font-medium"
                          >
                            📸 Camera
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              fileInputRef.current?.click();
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium"
                          >
                            📁 Upload
                          </button>
                          <button
                            onClick={() => markPhotoComplete(student.studentId)}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs font-medium"
                          >
                            ✅ Done
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
        <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3 text-sm">📋 Photo Verification Instructions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Camera Option:</h4>
              <ul className="space-y-1">
                <li>• Click "📸 Camera" to take a live photo</li>
                <li>• Ensure good lighting and clear visibility</li>
                <li>• Student should look directly at camera</li>
                <li>• Retake if photo quality is poor</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Upload Option:</h4>
              <ul className="space-y-1">
                <li>• Click "📁 Upload" to select from gallery</li>
                <li>• Accept photos from phone camera</li>
                <li>• Verify photo matches student identity</li>
                <li>• Use "✅ Done" if photo already taken</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <CameraModal />
    </div>
  );
}