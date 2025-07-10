import { useState, useEffect } from 'react';
import { redirect, useParams } from 'react-router-dom';

import { API_BASE_URL } from '../setup'; // Adjust path if needed

export default function DepartmentAdminPage() {
  const { department } = useParams(); // Get department from URL
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [verificationData, setVerificationData] = useState({});
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [departmentStats, setDepartmentStats] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [printingStudents, setPrintingStudents] = useState(new Set()); // Track which students are being printed
  const [studentSlipStatus, setStudentSlipStatus] = useState({}); // Track admission slip status for each student
  const [documentLinks, setDocumentLinks] = useState({}); // Store document links for the current student
  const [adminData, setAdminData] = useState(null);

  // Decode department name from URL (handle spaces and special characters)
  const departmentName = decodeURIComponent(department || '').replace(/-/g, ' ');
  const selectedDepartment = departmentName; // Fix for the missing selectedDepartment

  const documentTypes = [
    { id: '10th_marksheet', name: '10th Marksheet', required: true, backendField: 'tenthMarksheetUpload' },
    { id: '12th_marksheet', name: '12th Marksheet', required: true, backendField: 'twelfthMarksheetUpload' },
    { id: 'transfer_certificate', name: 'Transfer Certificate', required: true, backendField: 'transferCertificateUpload' },
    { id: 'character_certificate', name: 'Character Certificate', required: true, backendField: 'conductCertificateUpload' },
    { id: 'caste_certificate', name: 'Caste Certificate', required: false, note: '(if applicable)', backendField: 'casteCertificateUpload' },
    { id: 'income_certificate', name: 'Income Certificate', required: false, note: '(if applicable)', backendField: 'incomeCertificateUpload' },
    { id: 'domicile_certificate', name: 'Domicile Certificate', required: false, backendField: 'domicileCertificateUpload' },
    { id: 'migration_certificate', name: 'Migration Certificate', required: false, note: '(for external students)', backendField: 'migrationCertificateUpload' },
    { id: 'passport_photos', name: 'Passport Size Photos', required: true, backendField: 'photographUpload' },
    { id: 'aadhar_card', name: 'Aadhar Card Copy', required: true, backendField: 'aadhaarUpload' }
  ];

  // Load students for document verification
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


  useEffect(() => {
    if (departmentName) {
      loadStudentsForVerification();
      //   loadDepartmentStats();
    }
  }, [departmentName]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    window.location.href = '/admin/login';
  };
  
  // Filter students based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        (student.name && student.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (student.studentId && student.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (student.email && student.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    // Longer timeout for info notifications (loading states)
    const timeout = type === 'info' ? 10000 : 5000;
    setTimeout(() => setNotification({ message: '', type: '' }), timeout);
  };

  // Function to handle PDF printing/viewing
  const handlePrintDocument = async (student) => {
    const studentId = student.student_id; // Changed from student.studentId
    const hasExistingSlip = studentSlipStatus[studentId]?.hasSlip || false;
    
    // Add student to printing set to show loading state
    setPrintingStudents(prev => new Set(prev).add(studentId));
    
    // Show immediate feedback based on action
    if (hasExistingSlip) {
      showNotification(`Opening admission slip for ${student.name}...`, 'info');
    } else {
      showNotification(`Generating admission slip for ${student.name}...`, 'info');
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/print-document`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, // Add auth if needed
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      }

      // Parse JSON response
      const data = await response.json();
      
      if (data.success) {
        // Clear any existing info notification
        setNotification({ message: '', type: '' });
        
        // Open Google Drive link in new tab
        const documentUrl = data.documentUrl;
        const printWindow = window.open(documentUrl, '_blank');
        
        if (printWindow) {
          // Update slip status ONLY if a new slip was generated
          if (data.action === 'open_new') {
            setStudentSlipStatus(prev => ({
              ...prev,
              [studentId]: {
                hasSlip: true,
                slipLink: documentUrl
              }
            }));
          }

          // Show success message based on action
          const actionText = data.action === 'open_existing' 
            ? 'Admission slip opened successfully' 
            : 'Admission slip generated and opened successfully';
          showNotification(`${actionText} - ${student.name}`, 'success');
          
          // Optional: Focus the new window after a short delay
          setTimeout(() => {
            printWindow.focus();
          }, 1000);
          
        } else {
          setNotification({ message: '', type: '' }); // Clear loading notification
          showNotification('Print Once Again', 'error');
        }
      } else {
        throw new Error(data.error || 'Failed to generate document');
      }
      
    } catch (error) {
      console.error('Error fetching document:', error);
      // Clear any existing info notification
      setNotification({ message: '', type: '' });
      showNotification(`Failed to load document: ${error.message}`, 'error');
    } finally {
      // Remove student from printing set
      setPrintingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // Get button text and style based on slip status
  const getSlipButtonInfo = (student) => {
    // Fix: Use the same key that exists in the student object
    const studentId = student.student_id; // Changed from student.studentId
    const isPrinting = printingStudents.has(studentId);
    const canPrint = isStudentVerified(student);
    const hasSlip = studentSlipStatus[studentId]?.hasSlip || false;

    if (!canPrint) {
      return {
        text: '🖨️ Generate Slip',
        disabled: true,
        className: 'bg-gray-300 text-gray-500 cursor-not-allowed',
        title: 'Student must be verified first',
        showSpinner: false
      };
    }

    if (isPrinting) {
      return {
        text: hasSlip ? 'Opening Slip...' : 'Generating Slip...',
        disabled: true,
        className: 'bg-blue-600 text-white cursor-not-allowed',
        title: hasSlip ? 'Opening admission slip...' : 'Generating admission slip...',
        showSpinner: true
      };
    }

    if (hasSlip) {
      return {
        text: '📄 View Slip',
        disabled: false,
        className: 'bg-green-600 hover:bg-green-700 text-white',
        title: 'View admission slip',
        showSpinner: false
      };
    }

    return {
      text: '🖨️ Generate Slip',
      disabled: false,
      className: 'bg-blue-600 hover:bg-blue-700 text-white',
      title: 'Generate admission slip',
      showSpinner: false
    };
  };

  //   const loadDepartmentStats = async () => {
  //     try {
  //       const response = await fetch(`${API_BASE_URL}/api/admin/department-stats/${encodeURIComponent(departmentName)}`);
  //       const data = await response.json();

  //       if (response.ok && data.success) {
  //         setDepartmentStats(data.statistics);
  //       }
  //     } catch (error) {
  //       console.error('Error loading department stats:', error);
  //     }
  //   };

  const loadStudentsForVerification = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/students/department/${encodeURIComponent(departmentName)}/pending-verification`);
      const data = await response.json();
      console.log('Loaded students:', data);

      if (response.ok && data.success) {
        const studentsList = data.students.filter(student => 
          student.status === 'photo_uploaded' 
          && student.attendance === 'present'
        );
        setStudents(studentsList);
        setFilteredStudents(studentsList);

        // ✅ Count by status
        const total = studentsList.length;
        const verifiedCount = studentsList.filter(s => s.status === 'verified').length;
        console.log('Total students:', total, 'Verified count:', verifiedCount);
        const pendingCount = total - verifiedCount;

        const stats = {
          totalStudents: total,
          fullyVerified: verifiedCount,
          pendingVerification: pendingCount,
          completionRate: total > 0 ? Math.round((verifiedCount / total) * 100) : 0,
          overview: {
            todayCompleted: verifiedCount, // You can replace this with date-specific logic later
            departmentName: departmentName,
            documentsReady: '📄' // placeholder
          }
        };

        setDepartmentStats(stats);

        // Initialize admission slip status for each student
        const slipStatus = {};
        studentsList.forEach(student => {
          // Use student_id consistently (this is the key from backend)
          const studentId = student.student_id;
          slipStatus[studentId] = {
            hasSlip: student.admission_slip_generated || false,
            slipLink: student.admission_slip_link || null
          };
        });
        setStudentSlipStatus(slipStatus);
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

  const openVerificationModal = async (student) => {
    setSelectedStudent(student);

    // Load existing verification data
    try {
      console.log('Loading verification data for student:', student.student_id);
      const response = await fetch(`${API_BASE_URL}/api/students/${student.student_id}/documents`);
      const data = await response.json();

      console.log('Verification data:', data);
      if (response.ok && data.success && data.data?.documents) {
        setVerificationData(data.data.documents);
        
        // Set document links from the response
        if (data.links) {
          setDocumentLinks(data.links);
          console.log('Document links loaded:', data.links);
        } else {
          setDocumentLinks({});
        }
      } else {
        // Initialize with default values
        const defaultData = {};
        documentTypes.forEach(doc => {
          defaultData[doc.id] = {
            verified: false,
            notes: '',
            verifiedAt: null,
            verifiedBy: null
          };
        });
        setVerificationData(defaultData);
        setDocumentLinks({});
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
      // Initialize with default values
      const defaultData = {};
      documentTypes.forEach(doc => {
        defaultData[doc.id] = {
          verified: false,
          notes: '',
          verifiedAt: null,
          verifiedBy: null
        };
      });
      setVerificationData(defaultData);
      setDocumentLinks({});
    }

    setShowVerificationModal(true);
  };


  const handleDocumentVerification = (documentId, verified) => {
    setVerificationData(prev => ({
      ...prev,
      [documentId]: {
        ...prev[documentId],
        verified,
        verifiedAt: verified ? new Date().toISOString() : null,
        verifiedBy: verified ? 'Department Admin' : null
      }
    }));
  };

  const handleNotesChange = (documentId, notes) => {
    setVerificationData(prev => ({
      ...prev,
      [documentId]: {
        ...prev[documentId],
        notes
      }
    }));
  };

  const saveVerification = async () => {
    if (!selectedStudent) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/students/${selectedStudent.student_id}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: verificationData,
          departmentAdmin: 'Department Admin' // In real app, use logged-in admin info
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Check if all required documents are verified
        const requiredDocs = documentTypes.filter(doc => doc.required);
        const allRequiredVerified = requiredDocs.every(doc =>
          verificationData[doc.id]?.verified === true
        );

        if (allRequiredVerified) {
          // Update student status to documents_verified
          await updateStudentStatus(selectedStudent.studentId, 'documents_verified');
          showNotification('All documents verified! Student registration completed. ✅', 'success');
        } else {
          showNotification('Document verification saved successfully! 📄', 'success');
        }

        setShowVerificationModal(false);
        setSelectedStudent(null);
        loadStudentsForVerification(); // Refresh the list
      } else {
        showNotification(data.error || 'Failed to save verification', 'error');
      }
    } catch (error) {
      console.error('Error saving verification:', error);
      showNotification('Failed to save verification', 'error');
    }
  };

  const updateStudentStatus = async (studentId, status) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleBulkSelection = (studentId, checked) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, studentId]);
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId));
    }
  };

  const bulkApproveDocuments = async () => {
    if (selectedStudents.length === 0) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/students/bulk-verify-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: selectedStudents,
          verifiedBy: 'Department Admin'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showNotification(`${selectedStudents.length} students verified successfully! ✅`, 'success');
        setSelectedStudents([]);
        setBulkMode(false);
        loadStudentsForVerification();
      } else {
        showNotification('Bulk verification failed', 'error');
      }
    } catch (error) {
      console.error('Error in bulk verification:', error);
      showNotification('Bulk verification failed', 'error');
    }
  };

  const getVerificationProgress = (student) => {
    // Get actual progress from student data
    if (student.documentsProgress) {
      return student.documentsProgress;
    }
    // Fallback for demo purposes
    const verified = Math.floor(Math.random() * documentTypes.length);
    const total = documentTypes.length;
    return { verified, total, percentage: Math.round((verified / total) * 100) };
  };

  // Check if student is verified (eligible for printing)
  const isStudentVerified = (student) => {
    return student.status === 'verified' || student.status === 'documents_verified';
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

    const getNotificationIcon = () => {
      switch (type) {
        case 'success':
          return '✅';
        case 'error':
          return '❌';
        case 'info':
          return '⏳';
        default:
          return 'ℹ️';
      }
    };

    return (
      <div className={`p-3 rounded-lg mb-4 text-sm text-center ${getNotificationClasses()}`}>
        <p className="font-medium flex items-center justify-center gap-2">
          {type === 'info' && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
          )}
          <span>{getNotificationIcon()}</span>
          {message}
        </p>
      </div>
    );
  };

  // Document Verification Modal
const handleViewDocument = (documentId, studentId) => {
    // Find the document type to get the backend field name
    const documentType = documentTypes.find(doc => doc.id === documentId);
    const backendField = documentType?.backendField || documentId;
    
    // Check if we have the document link in documentLinks using the backend field name
    if (documentLinks && documentLinks[backendField]) {
      // Add Google Drive URL prefix to the document ID
      const fullDocumentUrl = `https://drive.google.com/file/d/${documentLinks[backendField]}/view`;
      // Open the document link in a new tab
      window.open(fullDocumentUrl, '_blank');
    } else {
      // Show a message that document is not available
      showNotification(`Document link not available for ${documentType?.name || documentId}`, 'error');
      console.log('Available document links:', documentLinks);
      console.log('Looking for field:', backendField);
    }
  };

// Update the Document Verification Modal section
// Replace the existing VerificationModal component with this updated version:

const VerificationModal = () => {
  if (!showVerificationModal || !selectedStudent) return null;

  const requiredDocs = documentTypes.filter(doc => doc.required);
  const optionalDocs = documentTypes.filter(doc => !doc.required);

  const verifiedCount = documentTypes.filter(doc =>
    verificationData[doc.id]?.verified === true
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="bg-blue-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold mb-2">Document Verification</h2>
              <p className="text-blue-100">
                {selectedStudent.name} ({selectedStudent.studentId})
              </p>
              <p className="text-sm text-blue-200">{selectedStudent.department}</p>
            </div>
            <button
              onClick={() => setShowVerificationModal(false)}
              className="text-white hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span>Verification Progress</span>
                <span>{verifiedCount}/{documentTypes.length} documents</span>
              </div>
              <div className="w-full bg-white bg-opacity-30 rounded-full h-2 mt-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(verifiedCount / documentTypes.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Required Documents */}
          <div className="mb-8">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">!</span>
              Required Documents
            </h3>

            <div className="space-y-3">
              {requiredDocs.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={doc.id}
                        checked={verificationData[doc.id]?.verified || false}
                        onChange={(e) => handleDocumentVerification(doc.id, e.target.checked)}
                        className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                      />
                    </div>

                    <div className="flex-1">
                      <label htmlFor={doc.id} className="flex items-center cursor-pointer">
                        <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
                        {verificationData[doc.id]?.verified && (
                          <span className="ml-2 text-green-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </label>

                      {verificationData[doc.id]?.verifiedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Verified on: {new Date(verificationData[doc.id].verifiedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <button
                        onClick={() => handleViewDocument(doc.id)}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-700 transition-colors"
                      >
                        View Document
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Documents */}
          <div className="mb-8">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">?</span>
              Optional Documents
            </h3>

            <div className="space-y-3">
              {optionalDocs.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={doc.id}
                        checked={verificationData[doc.id]?.verified || false}
                        onChange={(e) => handleDocumentVerification(doc.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                    </div>

                    <div className="flex-1">
                      <label htmlFor={doc.id} className="flex items-center cursor-pointer">
                        <span className="font-medium text-gray-900 text-sm">
                          {doc.name}
                          {doc.note && <span className="text-gray-500 font-normal ml-1 text-xs">{doc.note}</span>}
                        </span>
                        {verificationData[doc.id]?.verified && (
                          <span className="ml-2 text-blue-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </label>

                      {verificationData[doc.id]?.verifiedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Verified on: {new Date(verificationData[doc.id].verifiedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <button
                        onClick={() => handleViewDocument(doc.id, selectedStudent.student_id)}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-700 transition-colors"
                      >
                        View Document
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={() => setShowVerificationModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={saveVerification}
              className="px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800 text-sm font-medium"
            >
              Save Verification
            </button>
          </div>
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
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img
                src="/favicon.ico"
                alt="Dummy UniversityLogo"
                className="w-16 h-16 object-contain"
              />
            </div>
            <h1 className="text-base font-medium text-blue-900 leading-tight">
              Dummy University<br />
              Faculty of Engineering and Technology (FET)
            </h1>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {departmentName} Department Admin
          </h2>
          <p className="text-gray-600 text-sm">Document Verification & Student Management</p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <NotificationBar message={notification.message} type={notification.type} />

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Total Students</p>
              <p className="text-xl font-semibold text-gray-900">{departmentStats.totalStudents || 0}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Pending</p>
              <p className="text-xl font-semibold text-gray-900">{departmentStats.pendingVerification || 0}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Completed</p>
              <p className="text-xl font-semibold text-gray-900">{departmentStats.overview?.todayCompleted || 0}</p>
            </div>
            <div className="border border-gray-200 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Completion Rate</p>
              <p className="text-xl font-semibold text-gray-900">{departmentStats.completionRate || 0}%</p>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, student ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  bulkMode 
                    ? 'bg-blue-900 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {bulkMode ? '✓ Bulk Mode' : '📋 Bulk Mode'}
              </button>
              {bulkMode && selectedStudents.length > 0 && (
                <button
                  onClick={bulkApproveDocuments}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  ✅ Verify Selected ({selectedStudents.length})
                </button>
              )} */}
              <button
                onClick={() => {
                  loadStudentsForVerification();
                  // loadDepartmentStats();
                }}
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
              {/* <button
                onClick={() => window.open(`${API_BASE_URL}/api/students/export-department/${encodeURIComponent(departmentName)}`, '_blank')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                📊 Export
              </button> */}
            </div>
          </div>
        </div>

        {/* Students Table */}
        {selectedDepartment && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {bulkMode && (
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents(filteredStudents.map(s => s.student_id));
                            } else {
                              setSelectedStudents([]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Details
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
                      <td colSpan={bulkMode ? "5" : "4"} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                          Loading students...
                        </div>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={bulkMode ? "5" : "4"} className="px-4 py-8 text-center text-gray-500 text-sm">
                        {searchQuery ? 'No students found matching your search.' :
                          selectedDepartment ? 'No students pending document verification in this department.' :
                            'Please select a department to view students.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const progress = getVerificationProgress(student);
                      
                      return (
                        <tr key={student.student_id} className="hover:bg-gray-50">
                          {bulkMode && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedStudents.includes(student.student_id)}
                                onChange={(e) => handleBulkSelection(student.student_id, e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-xs text-gray-500">{student.email}</div>
                              <div className="text-xs text-gray-400 font-mono">{student.student_id}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 rounded text-white text-xs font-medium ${student.status === 'photo_taken'
                                ? 'bg-blue-900'
                                : student.status === 'verified'
                                  ? 'bg-green-600'
                                  : 'bg-amber-500'
                              }`}>
                              {student.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(student.registration_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2 flex-wrap">
                              <button
                                onClick={() => openVerificationModal(student)}
                                className="bg-blue-900 hover:bg-blue-800 text-white px-2 py-1 rounded text-xs font-medium"
                              >
                                📄 Verify Docs
                              </button>
                              
                              {/* Generate/View Slip Button - Dynamic based on status */}
                              {(() => {
                                const buttonInfo = getSlipButtonInfo(student);
                                return (
                                  <button
                                    onClick={() => handlePrintDocument(student)}
                                    disabled={buttonInfo.disabled}
                                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 min-w-[100px] justify-center ${buttonInfo.className}`}
                                    title={buttonInfo.title}
                                  >
                                    {buttonInfo.showSpinner ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                        <span className="ml-1">{buttonInfo.text}</span>
                                      </>
                                    ) : (
                                      buttonInfo.text
                                    )}
                                  </button>
                                );
                              })()}
                              
                              {/* <button
                                onClick={() => window.open(`${API_BASE_URL}/api/students/${student.studentId}/photo`, '_blank')}
                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium"
                              >
                                👁️ View Photo
                              </button> */}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3 text-sm">📋 Document Verification Guidelines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Required Documents (Must verify all):</h4>
              <ul className="space-y-1">
                <li>• 10th Marksheet - Original with clear marks</li>
                <li>• 12th Marksheet - Original with clear marks</li>
                <li>• Transfer Certificate - From previous institution</li>
                <li>• Character Certificate - From previous institution</li>
                <li>• Passport Photos - Recent colored photos</li>
                <li>• Aadhar Card Copy - Clear readable copy</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Optional Documents (Verify if applicable):</h4>
              <ul className="space-y-1">
                <li>• Caste Certificate - For reserved category students</li>
                <li>• Income Certificate - For fee concession</li>
                <li>• Domicile Certificate - For local students</li>
                <li>• Migration Certificate - For external students</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 p-3 bg-blue-100 border border-blue-300 rounded">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> All required documents must be verified before student registration can be marked as complete.
              Use the notes section to add any specific observations or requirements. The Generate Slip button becomes active only after student verification is complete, 
              shows a loading spinner during processing, and changes to View Slip once generated.
            </p>
          </div>
        </div>
      </div>

      <VerificationModal />
    </div>
  );
}