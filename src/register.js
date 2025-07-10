import { useState, useEffect, useRef } from 'react';

// Configuration for your Flask backend
const API_BASE_URL = 'http://localhost:5000'; // Adjust as needed

// Move utility components outside to prevent recreation on every render
const PhoneInput = ({ value, onChange, countryCode, onCountryChange, placeholder, id, name, disabled = false }) => {
  const countryCodes = [
    { code: '+91', country: 'India' },
    { code: '+1', country: 'USA/Canada' },
    { code: '+44', country: 'UK' },
    { code: '+61', country: 'Australia' },
    { code: '+971', country: 'UAE' },
    { code: '+65', country: 'Singapore' }
  ];

  return (
    <div className="flex">
      <select
        value={countryCode}
        onChange={(e) => onCountryChange(e.target.value)}
        disabled={disabled}
        className={`w-20 px-2 py-2 border border-gray-300 border-r-0 rounded-l text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'
        }`}
      >
        {countryCodes.map(({ code, country }) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </select>
      <input
        type="tel"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`flex-1 px-3 py-2 border border-gray-300 border-l-0 rounded-r focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
          disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
        }`}
      />
    </div>
  );
};

const FileUpload = ({ label, name, required = false, accept = "image/*,.pdf", onFileUpload, uploadedFiles }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <input
        type="file"
        onChange={(e) => onFileUpload(e, name)}
        accept={accept}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-lg p-2"
      />
      {uploadedFiles[name] && (
        <div className="mt-2 flex items-center text-sm text-green-600">
          <span className="mr-2">✓</span>
          <span className="truncate">{uploadedFiles[name]}</span>
        </div>
      )}
    </div>
    <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Formats: JPEG, PNG, PDF</p>
  </div>
);

const InputField = ({ label, name, type = 'text', required = false, placeholder = '', options = null, formData, handleInputChange, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {options ? (
      <select
        name={name}
        value={formData[name]}
        onChange={handleInputChange}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        required={required}
        {...props}
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((option, index) => (
          <option key={index} value={option}>{option}</option>
        ))}
      </select>
    ) : type === 'textarea' ? (
      <textarea
        name={name}
        value={formData[name]}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        required={required}
        rows={3}
        {...props}
      />
    ) : (
      <input
        type={type}
        name={name}
        value={formData[name]}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        required={required}
        {...props}
      />
    )}
  </div>
);

export default function StudentRegistration() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const hasInitialized = useRef(false);

  const [uploadedFiles, setUploadedFiles] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});

  // OTP verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResendOtp, setCanResendOtp] = useState(true);

  // Comprehensive form state
  const [formData, setFormData] = useState({
    // Basic Personal Information
    studentFullName: '',
    gender: '',
    dateOfBirth: '',
    bloodGroup: '',
    nationality: 'Indian',
    religion: '',
    caste: '',
    motherTongue: '',
    category: '',
    birthPlace: '',
    
    // Student Contact Information (moved from contact section)
    studentContactNo: '',
    studentEmail: '',
    
    // Parent Contact for OTP Verification
    parentContactNo: '',
    
    // Contact Information (now only address info)
    // studentContactNo, studentOfficialEmail, studentEmail moved to basic info
    
    // Address Information
    correspondenceAddress: '',
    correspondenceCity: '',
    correspondenceState: '',
    correspondenceCountry: 'India',
    correspondencePostalCode: '',
    permanentAddress: '',
    permanentCity: '',
    permanentState: '',
    permanentCountry: 'India',
    permanentPostalCode: '',
    
    // Academic Information - 10th
    tenthMarksCardNumber: '',
    tenthBoardUniversity: '',
    tenthSchoolName: '',
    tenthSchoolState: '',
    tenthPassedOutYear: '',
    tenthTotalMarks: '',
    tenthScoredMarks: '',
    tenthPercentage: '',
    
    // Academic Information - 12th
    collegeInstitutionName: '',
    collegeStateName: '',
    boardUniversity: '',
    twelfthMarksCardNumber: '',
    twelfthRegisterNumber: '',
    twelfthPassedOutYear: '',
    twelfthTotalMarks: '',
    twelfthScoredMarks: '',
    twelfthPercentage: '',
    
    // Subject-wise 12th marks
    pcmTotal: '',
    pcmPercentage: '',
    physicsTotal: '',
    physicsScored: '',
    chemistryTotal: '',
    chemistryScored: '',
    mathematicsTotal: '',
    mathematicsScored: '',
    biologyTotal: '',
    biologyScored: '',
    computerScienceTotal: '',
    computerScienceScored: '',
    englishTotal: '',
    englishScored: '',
    languageType: '',
    languageTotal: '',
    languageScored: '',
    additionalLanguage: '',
    additionalLanguageTotal: '',
    additionalLanguageScored: '',
    
    // Parent Information
    fatherName: '',
    fatherOccupation: '',
    fatherIncome: '',
    fatherMobile: '',
    motherName: '',
    motherOccupation: '',
    motherIncome: '',
    motherMobile: '',
    parentEmail: '',
    
    // Guardian Information
    guardianName: '',
    guardianOccupation: '',
    guardianIncome: '',
    
    // University Information
    department: '',
    programName: '',
    admissionType: '',
    juApplication: '',
    
    // Document Information
    
    // Document Uploads
    aadhaarUpload: null,
    tenthMarksheetUpload: null,
    twelfthMarksheetUpload: null,
    transferCertificateUpload: null,
    conductCertificateUpload: null,
    casteCertificateUpload: null,
    incomeCertificateUpload: null,
    photographUpload: null
  });

  // Additional state for address copy and file uploads
  const [sameAsCorrespondence, setSameAsCorrespondence] = useState(false);
  
  // Phone country codes
  const [phoneCountry, setPhoneCountry] = useState('+91');
  const [parentPhoneCountry, setParentPhoneCountry] = useState('+91');
  const [fatherPhoneCountry, setFatherPhoneCountry] = useState('+91');
  const [motherPhoneCountry, setMotherPhoneCountry] = useState('+91');

  // Form configuration
  const formSteps = [
    { id: 'basic', title: 'Basic & Contact Info', icon: '1', color: 'blue' },
    { id: 'address', title: 'Address Details', icon: '2', color: 'green' },
    { id: 'academic', title: 'Academic Details', icon: '3', color: 'purple' },
    { id: 'subjects', title: 'Subject Marks', icon: '4', color: 'orange' },
    { id: 'family', title: 'Family Information', icon: '5', color: 'red' },
    { id: 'university', title: 'University Details', icon: '6', color: 'indigo' },
    { id: 'documents', title: 'Documents', icon: '7', color: 'teal' }
  ];

  // Static data arrays
  const departments = [
    'Computer Science and Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Electrical and Electronics Engineering',
    'Information Technology',
    'Biotechnology Engineering',
    'Aerospace Engineering',
    'Automobile Engineering'
  ];

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
  const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
  const languages = ['Kannada', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Sanskrit', 'Other'];
  const boardTypes = ['CBSE', 'ICSE', 'State Board', 'IB', 'Other'];
  const admissionTypes = ['Management', 'CET', 'COMEDK', 'JEE Main', 'Other'];

  // Initialize component
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      const savedData = JSON.parse(localStorage.getItem('studentRegistration') || 'null');
      if (savedData) {
        setStudentData(savedData);
        setMessage('Welcome back! Your registration details are shown below.');
      }
    } catch (error) {
      console.error('localStorage error:', error);
      localStorage.removeItem('studentRegistration');
    }
  }, []);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File size should not exceed 5MB');
      return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('Please upload only JPEG, PNG, or PDF files');
      return;
    }

    // Store file data for batch upload during registration
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = new Uint8Array(e.target.result);
      
      // Update form data with file information
      setFormData(prev => ({ 
        ...prev, 
        [fieldName]: {
          file_data: fileData,
          filename: file.name,
          file_type: file.type,
          file_size: file.size
        }
      }));
      
      // Update upload status to show file is ready
      setUploadedFiles(prev => ({ 
        ...prev, 
        [fieldName]: file.name 
      }));
      
      setUploadStatus(prev => ({
        ...prev,
        [fieldName]: { uploading: false, progress: 100, error: null, success: true, ready: true }
      }));
      
      setMessage('');
    };
    
    reader.onerror = function() {
      setUploadStatus(prev => ({
        ...prev,
        [fieldName]: { uploading: false, progress: 0, error: 'Failed to read file', success: false }
      }));
    };
    
    reader.readAsArrayBuffer(file);
  };

  const copyCorrespondenceAddress = () => {
    if (sameAsCorrespondence) {
      setFormData(prev => ({
        ...prev,
        permanentAddress: prev.correspondenceAddress,
        permanentCity: prev.correspondenceCity,
        permanentState: prev.correspondenceState,
        permanentCountry: prev.correspondenceCountry,
        permanentPostalCode: prev.correspondencePostalCode
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permanentAddress: '',
        permanentCity: '',
        permanentState: '',
        permanentCountry: 'India',
        permanentPostalCode: ''
      }));
    }
  };

  useEffect(() => {
    copyCorrespondenceAddress();
  }, [sameAsCorrespondence]);

  // OTP Timer Effect
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(timer => timer - 1);
      }, 1000);
    } else if (otpTimer === 0 && otpSent) {
      setCanResendOtp(true);
    }
    return () => clearInterval(interval);
  }, [otpTimer, otpSent]);

  const validateStep = (stepIndex) => {
    const requiredFieldsByStep = [
      // Step 0: Basic & Contact Info
      ['studentFullName', 'gender', 'dateOfBirth', 'nationality', 'studentContactNo', 'studentEmail', 'parentContactNo'],
      // Step 1: Address Details
      ['correspondenceAddress', 'correspondenceCity', 'correspondenceState', 'correspondencePostalCode'],
      // Step 2: Academic Details
      ['tenthSchoolName', 'tenthBoardUniversity', 'tenthPassedOutYear', 'collegeInstitutionName', 'boardUniversity', 'twelfthPassedOutYear'],
      // Step 3: Subject Marks
      ['twelfthTotalMarks', 'twelfthScoredMarks', 'twelfthPercentage'],
      // Step 4: Family Information
      ['fatherName', 'motherName', 'fatherMobile', 'motherMobile'],
      // Step 5: University Details
      ['department', 'programName', 'admissionType', 'juApplication'],
      // Step 6: Documents (at least some required docs)
      []
    ];

    const required = requiredFieldsByStep[stepIndex] || [];
    const missingFields = [];
    
    // Check each required field
    for (const field of required) {
      const value = formData[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
      }
    }

    // Additional validation for specific steps
    if (stepIndex === 0) {
      // Step 0: Basic Info - Also check OTP verification
      if (!otpVerified) {
        return 'Please verify the parent\'s phone number with OTP before proceeding to the next step.';
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.studentEmail && !emailRegex.test(formData.studentEmail)) {
        return 'Please enter a valid email address.';
      }
      
      // Validate phone number (basic check)
      if (formData.studentContactNo && formData.studentContactNo.length < 10) {
        return 'Please enter a valid contact number (at least 10 digits).';
      }
      
      if (formData.parentContactNo && formData.parentContactNo.length < 10) {
        return 'Please enter a valid parent contact number (at least 10 digits).';
      }
    }
    
    if (stepIndex === 2) {
      // Step 2: Academic Details - Validate years
      const currentYear = new Date().getFullYear();
      if (formData.tenthPassedOutYear && (formData.tenthPassedOutYear > currentYear || formData.tenthPassedOutYear < currentYear - 15)) {
        return 'Please enter a valid 10th passed out year.';
      }
      if (formData.twelfthPassedOutYear && (formData.twelfthPassedOutYear > currentYear || formData.twelfthPassedOutYear < currentYear - 10)) {
        return 'Please enter a valid 12th passed out year.';
      }
    }
    
    if (stepIndex === 3) {
      // Step 3: Subject Marks - Validate marks are reasonable
      const totalMarks = parseFloat(formData.twelfthTotalMarks);
      const scoredMarks = parseFloat(formData.twelfthScoredMarks);
      
      if (totalMarks && scoredMarks && scoredMarks > totalMarks) {
        return 'Scored marks cannot be greater than total marks.';
      }
      
      if (formData.twelfthPercentage && (formData.twelfthPercentage < 0 || formData.twelfthPercentage > 100)) {
        return 'Please enter a valid percentage (0-100).';
      }
    }
    
    if (stepIndex === 4) {
      // Step 4: Family Info - Validate phone numbers
      if (formData.fatherMobile && formData.fatherMobile.length < 10) {
        return 'Please enter a valid father\'s mobile number (at least 10 digits).';
      }
      if (formData.motherMobile && formData.motherMobile.length < 10) {
        return 'Please enter a valid mother\'s mobile number (at least 10 digits).';
      }
    }

    // If there are missing required fields, return error message
    if (missingFields.length > 0) {
      const fieldLabels = {
        studentFullName: 'Student Full Name',
        gender: 'Gender',
        dateOfBirth: 'Date of Birth',
        nationality: 'Nationality',
        studentContactNo: 'Student Contact Number',
        studentEmail: 'Student Email',
        parentContactNo: 'Parent Contact Number',
        correspondenceAddress: 'Correspondence Address',
        correspondenceCity: 'Correspondence City',
        correspondenceState: 'Correspondence State',
        correspondencePostalCode: 'Correspondence Postal Code',
        tenthSchoolName: '10th School Name',
        tenthBoardUniversity: '10th Board/University',
        tenthPassedOutYear: '10th Passed Out Year',
        collegeInstitutionName: 'College/Institution Name',
        boardUniversity: '12th Board/University',
        twelfthPassedOutYear: '12th Passed Out Year',
        twelfthTotalMarks: '12th Total Marks',
        twelfthScoredMarks: '12th Scored Marks',
        twelfthPercentage: '12th Percentage',
        fatherName: 'Father\'s Name',
        motherName: 'Mother\'s Name',
        fatherMobile: 'Father\'s Mobile',
        motherMobile: 'Mother\'s Mobile',
        department: 'Department',
        programName: 'Program Name',
        admissionType: 'Admission Type',
        juApplication: 'JU Application Number'
      };
      
      const missingLabels = missingFields.map(field => fieldLabels[field] || field);
      return `Please fill in the following required fields: ${missingLabels.join(', ')}`;
    }

    return null;
  };

  const nextStep = () => {
    const error = validateStep(currentStep);
    if (error) {
      setMessage(error);
      // Scroll to top to show error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    if (currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setMessage('');
      // Smooth scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setMessage('');
      // Smooth scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  const handleRegistration = async () => {
    if (loading) return;

    const error = validateStep(currentStep);
    if (error) {
      setMessage(error);
      return;
    }

    // Check if JU Application number is provided
    if (!formData.juApplication || formData.juApplication.trim() === '') {
      setMessage('JU Application number is required for registration');
      return;
    }

    setLoading(true);
    setMessage('Processing registration and uploading documents...');

    try {
      // Prepare documents data for backend
      const documentsData = {};
      const documentFields = [
        'aadhaarUpload',
        'tenthMarksheetUpload', 
        'twelfthMarksheetUpload',
        'transferCertificateUpload',
        'conductCertificateUpload',
        'casteCertificateUpload',
        'incomeCertificateUpload',
        'photographUpload'
      ];

      // Convert file data for documents that are uploaded
      documentFields.forEach(fieldName => {
        const fileInfo = formData[fieldName];
        if (fileInfo && fileInfo.file_data) {
          documentsData[fieldName] = {
            file_data: Array.from(fileInfo.file_data), // Convert Uint8Array to regular array for JSON
            filename: fileInfo.filename,
            file_type: fileInfo.file_type,
            file_size: fileInfo.file_size
          };
        }
      });

      // Prepare registration data
      const registrationData = {
        ...formData,
        documents: documentsData // Include documents for batch upload
      };

      // Remove individual file objects from main data (they're now in documents)
      documentFields.forEach(fieldName => {
        if (registrationData[fieldName] && typeof registrationData[fieldName] === 'object') {
          delete registrationData[fieldName];
        }
      });

      console.log('Sending registration data with documents:', {
        studentName: registrationData.studentFullName,
        juApplication: registrationData.juApplication,
        documentCount: Object.keys(documentsData).length
      });

      const response = await fetch(`${API_BASE_URL}/api/students/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const registrationData = {
          name: data.data.studentFullName || data.data.name,
          studentId: data.studentId,
          juApplication: data.juApplication,
          department: data.data.department,
          status: 'pending',
          hasPhoto: false,
          applicationNumber: null,
          registrationDate: new Date().toISOString(),
          documentUpload: data.documentUpload
        };

        localStorage.setItem('studentRegistration', JSON.stringify(registrationData));
        setStudentData(registrationData);
        
        // Enhanced success message with document upload info
        const docUpload = data.documentUpload || {};
        const uploadMsg = docUpload.uploadedCount > 0 
          ? ` ${docUpload.uploadedCount} documents uploaded successfully.`
          : '';
        
        setMessage(`Registration successful! 🎉${uploadMsg}`);
      } else {
        setMessage(data.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage('Error: Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Functions
  const sendOtp = async () => {
    if (!formData.parentContactNo || formData.parentContactNo.trim() === '') {
      setMessage('Please enter parent\'s phone number first');
      return;
    }

    setOtpLoading(true);
    setMessage('Sending OTP...');

    try {
      // Simulate API call to send OTP
      const response = await fetch(`${API_BASE_URL}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: `${parentPhoneCountry}${formData.parentContactNo}`,
          type: 'parent_verification'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOtpSent(true);
        setOtpTimer(60); // 60 seconds timer
        setCanResendOtp(false);
        setMessage('OTP sent successfully! Please check your phone.');
      } else {
        setMessage(data.error || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP send error:', error);
      // For demo purposes, simulate successful OTP send
      setOtpSent(true);
      setOtpTimer(60);
      setCanResendOtp(false);
      setMessage('OTP sent successfully! Please check your phone. (Demo: Use 123456)');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.trim() === '') {
      setMessage('Please enter the OTP');
      return;
    }

    setOtpLoading(true);
    setMessage('Verifying OTP...');

    try {
      // Simulate API call to verify OTP
      const response = await fetch(`${API_BASE_URL}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: `${parentPhoneCountry}${formData.parentContactNo}`,
          otp: otp,
          type: 'parent_verification'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOtpVerified(true);
        setMessage('✅ Parent phone number verified successfully!');
      } else {
        setMessage(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP verify error:', error);
      // For demo purposes, accept 123456 as valid OTP
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = () => {
    if (canResendOtp) {
      setOtp('');
      sendOtp();
    }
  };

  const checkStudentStatus = async () => {
    if (!studentData?.studentId || checkingStatus) return;

    setCheckingStatus(true);
    setMessage('Checking for updates...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/students/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentData.studentId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const updatedData = {
          name: data.student.name,
          studentId: data.student.studentId,
          department: data.student.department,
          status: data.student.status,
          hasPhoto: data.student.hasPhoto,
          applicationNumber: data.student.applicationNumber,
          registrationDate: data.student.registrationDate
        };

        localStorage.setItem('studentRegistration', JSON.stringify(updatedData));
        setStudentData(updatedData);
        setMessage('Status updated! 🎉');
      } else {
        setMessage(data.error || 'No updates found');
      }
    } catch (error) {
      console.error('Status check error:', error);
      setMessage('Error: Unable to connect to server.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const ConfirmDialog = () => {
    if (!showConfirmDialog) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-xl">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Clear Registration Data?</h3>
          <p className="text-gray-600 mb-6 text-sm">This will permanently delete your registration data. This action cannot be undone.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowConfirmDialog(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 text-sm">Cancel</button>
            <button onClick={() => {
              localStorage.removeItem('studentRegistration');
              setStudentData(null);
              setMessage('Registration data cleared');
              setShowConfirmDialog(false);
            }} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Delete</button>
          </div>
        </div>
      </div>
    );
  };

  const LoadingPopup = () => {
    if (!loading) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-8 rounded-lg max-w-sm w-full shadow-xl text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Submitting Your Form</h3>
          <p className="text-gray-600 text-sm">Please wait while we process your registration and upload your documents...</p>
        </div>
      </div>
    );
  };

  // Step rendering functions
  const renderBasicInformation = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">1</span>
          Personal Information
        </h4>
        <div className="space-y-4">
          <InputField label="Student Full Name" name="studentFullName" required placeholder="As per 10th Marks Sheet" formData={formData} handleInputChange={handleInputChange} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Gender" name="gender" required options={['Male', 'Female', 'Other']} formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Date of Birth" name="dateOfBirth"   max="2007-12-31" type="date" required formData={formData} handleInputChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Blood Group" name="bloodGroup" options={bloodGroups} formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Nationality" name="nationality" required formData={formData} handleInputChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Religion" name="religion" options={religions} formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Category" name="category" options={categories} formData={formData} handleInputChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Birth Place" name="birthPlace" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Mother Tongue" name="motherTongue" options={languages} formData={formData} handleInputChange={handleInputChange} />
          </div>

          <InputField label="Caste" name="caste" formData={formData} handleInputChange={handleInputChange} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">2</span>
          Student Contact Information
        </h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Contact Number <span className="text-red-500">*</span></label>
            <PhoneInput
              value={formData.studentContactNo}
              onChange={handleInputChange}
              countryCode={phoneCountry}
              onCountryChange={setPhoneCountry}
              placeholder="Enter contact number"
              id="studentContactNo"
              name="studentContactNo"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
            <InputField label="Student Personal Email" name="studentEmail" type="email" required formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">3</span>
          Parent Contact Verification
        </h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parent Contact Number <span className="text-red-500">*</span>
              {otpVerified && <span className="text-green-600 text-xs ml-2">✅ Verified</span>}
            </label>
            <div className="relative">
              <PhoneInput
                value={formData.parentContactNo}
                onChange={otpVerified ? () => {} : handleInputChange}
                countryCode={parentPhoneCountry}
                onCountryChange={otpVerified ? () => {} : setParentPhoneCountry}
                placeholder="Enter parent's contact number"
                id="parentContactNo"
                name="parentContactNo"
                disabled={otpVerified}
              />
              {otpVerified && (
                <div className="absolute inset-0 bg-green-50 bg-opacity-50 rounded border-2 border-green-300 pointer-events-none flex items-center justify-end pr-3">
                  <span className="text-green-600 text-sm font-medium">🔒 Verified & Locked</span>
                </div>
              )}
            </div>
            {otpVerified && (
              <p className="text-xs text-green-600 mt-1">
                This number has been verified and cannot be changed. Contact support if you need to update it.
              </p>
            )}
          </div>

          {/* OTP Verification Section */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-3">Phone Number Verification</h5>
            
            {!otpSent ? (
              <div>
                <p className="text-sm text-blue-800 mb-3">
                  We need to verify the parent's phone number for important communications.
                </p>
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={otpLoading || !formData.parentContactNo}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm font-medium transition-colors"
                >
                  {otpLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div>
                {!otpVerified ? (
                  <div className="space-y-3">
                    <p className="text-sm text-blue-800">
                      OTP sent to {parentPhoneCountry} {formData.parentContactNo}
                    </p>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        maxLength="6"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={verifyOtp}
                        disabled={otpLoading || !otp}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm font-medium transition-colors"
                      >
                        {otpLoading ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        {otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'OTP expired'}
                      </span>
                      <button
                        type="button"
                        onClick={resendOtp}
                        disabled={!canResendOtp || otpLoading}
                        className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-green-800">
                    <span className="mr-2">✅</span>
                    <span className="text-sm font-medium">Phone number verified successfully!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactAndAddress = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">1</span>
          Correspondence Address
        </h4>
        <div className="space-y-4">
          <InputField label="Address" name="correspondenceAddress" type="textarea" formData={formData} handleInputChange={handleInputChange} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="City" name="correspondenceCity" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="State" name="correspondenceState" formData={formData} handleInputChange={handleInputChange} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Country" name="correspondenceCountry" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Postal/PIN Code" name="correspondencePostalCode" formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">2</span>
          Permanent Address
        </h4>
        <div className="mb-4">
          <label className="flex items-center space-x-2 text-sm text-gray-700 p-3 bg-gray-50 rounded-lg border">
            <input
              type="checkbox"
              checked={sameAsCorrespondence}
              onChange={(e) => setSameAsCorrespondence(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Same as correspondence address</span>
          </label>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="permanentAddress"
              value={formData.permanentAddress}
              onChange={handleInputChange}
              placeholder="Permanent address"
              className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                sameAsCorrespondence ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              rows={3}
              disabled={sameAsCorrespondence}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="permanentCity"
                value={formData.permanentCity}
                onChange={handleInputChange}
                placeholder="City"
                className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                  sameAsCorrespondence ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={sameAsCorrespondence}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="permanentState"
                value={formData.permanentState}
                onChange={handleInputChange}
                placeholder="State"
                className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                  sameAsCorrespondence ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={sameAsCorrespondence}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="permanentCountry"
                value={formData.permanentCountry}
                onChange={handleInputChange}
                placeholder="Country"
                className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                  sameAsCorrespondence ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={sameAsCorrespondence}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal/PIN Code</label>
              <input
                type="text"
                name="permanentPostalCode"
                value={formData.permanentPostalCode}
                onChange={handleInputChange}
                placeholder="Postal/PIN Code"
                className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${
                  sameAsCorrespondence ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={sameAsCorrespondence}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAcademicDetails = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">1</span>
          10th Standard Details
        </h4>
        <div className="space-y-4">
          <InputField label="10th School Name" name="tenthSchoolName" formData={formData} handleInputChange={handleInputChange} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="10th School State" name="tenthSchoolState" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="10th Board/University" name="tenthBoardUniversity" options={boardTypes} formData={formData} handleInputChange={handleInputChange} />
          </div>

          <InputField label="10th Marks Card Number" name="tenthMarksCardNumber" formData={formData} handleInputChange={handleInputChange} />

          <InputField 
            label="10th Passed Out Year" 
            name="tenthPassedOutYear" 
            options={Array.from({length: 15}, (_, i) => new Date().getFullYear() - i)} 
            formData={formData} 
            handleInputChange={handleInputChange}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="10th Total Marks" name="tenthTotalMarks" type="number" placeholder="e.g., 500" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="10th Scored Marks" name="tenthScoredMarks" type="number" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="10th Percentage" name="tenthPercentage" type="number" step="0.01" formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">2</span>
          12th Standard Details
        </h4>
        <div className="space-y-4">
          <InputField label="College/Institution Name" name="collegeInstitutionName" formData={formData} handleInputChange={handleInputChange} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="State Name" name="collegeStateName" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Board/University" name="boardUniversity" options={boardTypes} formData={formData} handleInputChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="12th Marks Card Number" name="twelfthMarksCardNumber" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="12th Register Number" name="twelfthRegisterNumber" formData={formData} handleInputChange={handleInputChange} />
          </div>

          <InputField 
            label="12th Passed Out Year" 
            name="twelfthPassedOutYear" 
            options={Array.from({length: 10}, (_, i) => new Date().getFullYear() - i)} 
            formData={formData} 
            handleInputChange={handleInputChange}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="12th Total Marks" name="twelfthTotalMarks" type="number" placeholder="e.g., 600" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="12th Overall Scored" name="twelfthScoredMarks" type="number" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="12th Percentage" name="twelfthPercentage" type="number" step="0.01" formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubjectMarks = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">1</span>
          PCM (Physics + Chemistry + Mathematics)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="PCM Total Marks" name="pcmTotal" type="number" formData={formData} handleInputChange={handleInputChange} />
          <InputField label="PCM Percentage" name="pcmPercentage" type="number" step="0.01" formData={formData} handleInputChange={handleInputChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'English'].map(subject => (
          <div key={subject} className="bg-white border border-gray-200 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs mr-2 font-semibold">
                {subject.charAt(0)}
              </span>
              {subject} {subject === 'Biology' || subject === 'Computer Science' ? '(if applicable)' : ''}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField 
                label="Total Marks" 
                name={`${subject.toLowerCase().replace(' ', '')}Total`} 
                type="number" 
                placeholder="e.g., 100" 
                formData={formData} 
                handleInputChange={handleInputChange}
              />
              <InputField 
                label="Scored Marks" 
                name={`${subject.toLowerCase().replace(' ', '')}Scored`} 
                type="number" 
                formData={formData} 
                handleInputChange={handleInputChange}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs mr-2 font-semibold">L</span>
          Regional Language
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField label="Language Type" name="languageType" options={languages} formData={formData} handleInputChange={handleInputChange} />
          <InputField label="Total Marks" name="languageTotal" type="number" placeholder="e.g., 100" formData={formData} handleInputChange={handleInputChange} />
          <InputField label="Scored Marks" name="languageScored" type="number" formData={formData} handleInputChange={handleInputChange} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs mr-2 font-semibold">+</span>
          Additional Language (if applicable)
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField label="Additional Language" name="additionalLanguage" formData={formData} handleInputChange={handleInputChange} />
          <InputField label="Total Marks" name="additionalLanguageTotal" type="number" placeholder="e.g., 100" formData={formData} handleInputChange={handleInputChange} />
          <InputField label="Scored Marks" name="additionalLanguageScored" type="number" formData={formData} handleInputChange={handleInputChange} />
        </div>
      </div>
    </div>
  );

  const renderFamilyInformation = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">F</span>
          Father's Information
        </h4>
        <div className="space-y-4">
          <InputField label="Father's Name" name="fatherName" placeholder="As per 10th Marks Sheet" formData={formData} handleInputChange={handleInputChange} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Father's Occupation" name="fatherOccupation" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Father's Income (Per Annum)" name="fatherIncome" type="number" formData={formData} handleInputChange={handleInputChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Father's Mobile Number <span className="text-red-500">*</span></label>
            <PhoneInput
              value={formData.fatherMobile}
              onChange={handleInputChange}
              countryCode={fatherPhoneCountry}
              onCountryChange={setFatherPhoneCountry}
              placeholder="Father's mobile number"
              id="fatherMobile"
              name="fatherMobile"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">M</span>
          Mother's Information
        </h4>
        <div className="space-y-4">
          <InputField label="Mother's Name" name="motherName" placeholder="As per 10th Marks Sheet" formData={formData} handleInputChange={handleInputChange} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Mother's Occupation" name="motherOccupation" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Mother's Income (Per Annum)" name="motherIncome" type="number" formData={formData} handleInputChange={handleInputChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Mobile Number <span className="text-red-500">*</span></label>
            <PhoneInput
              value={formData.motherMobile}
              onChange={handleInputChange}
              countryCode={motherPhoneCountry}
              onCountryChange={setMotherPhoneCountry}
              placeholder="Mother's mobile number"
              id="motherMobile"
              name="motherMobile"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">@</span>
          Parent Contact
        </h4>
        <InputField label="Parent's Email" name="parentEmail" type="email" formData={formData} handleInputChange={handleInputChange} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">G</span>
          Guardian Information (if different from parents)
        </h4>
        <div className="space-y-4">
          <InputField label="Guardian Name" name="guardianName" formData={formData} handleInputChange={handleInputChange} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Guardian Occupation" name="guardianOccupation" formData={formData} handleInputChange={handleInputChange} />
            <InputField label="Guardian Income (Per Annum)" name="guardianIncome" type="number" formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderUniversityDetails = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">U</span>
          University & Program Details
        </h4>
        <div className="space-y-4">
          <InputField label="Department/Branch" name="department" options={departments} formData={formData} handleInputChange={handleInputChange} />

          <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
            <InputField label="Program Name" name="programName" placeholder="e.g., B.Tech, B.E." formData={formData} handleInputChange={handleInputChange} />
          </div>

          <InputField label="Admission Type" name="admissionType" options={admissionTypes} formData={formData} handleInputChange={handleInputChange} />

          <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
            <InputField label="JU Application Number" name="juApplication" formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-base flex items-center">
          <span className="w-8 h-8 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-sm mr-3 font-semibold">D</span>
          Document Uploads
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Select documents now - they will be uploaded to Google Drive when you complete registration.
          A folder will be created using your JU Application Number: <strong>{formData.juApplication || 'Not provided'}</strong>
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FileUpload 
            label="Aadhaar Card" 
            name="aadhaarUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="10th Standard Marks Card" 
            name="tenthMarksheetUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="12th Standard Marks Card" 
            name="twelfthMarksheetUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="Transfer Certificate" 
            name="transferCertificateUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="Conduct Certificate" 
            name="conductCertificateUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="Caste Certificate (if applicable)" 
            name="casteCertificateUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="Income Certificate (if applicable)" 
            name="incomeCertificateUpload" 
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
          
          <FileUpload 
            label="Passport Size Photograph" 
            name="photographUpload" 
            accept="image/*"
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            uploadStatus={uploadStatus}
          />
        </div>
      </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
        <h4 className="font-medium text-amber-900 mb-2">Important Guidelines</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Upload clear, readable scanned copies or high-quality photos</li>
          <li>• Maximum file size: 5MB per document</li>
          <li>• Accepted formats: JPEG, PNG, PDF</li>
          <li>• Documents will be uploaded to Google Drive during registration</li>
          <li>• A folder will be created with your JU Application Number</li>
          <li>• Original documents required for verification during admission</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <h4 className="font-medium text-green-900 mb-2">Final Step</h4>
        <p className="text-sm text-green-800">
          After submitting this form, all your documents will be uploaded to Google Drive in a folder named with your JU Application Number.
          You will receive a Student ID. Please save this ID and proceed to the photo room for your student ID card creation, 
          followed by document verification at your department office.
        </p>
      </div>
    </div>
  );

  const stepRenderers = [
    renderBasicInformation,
    renderContactAndAddress,
    renderAcademicDetails,
    renderSubjectMarks,
    renderFamilyInformation,
    renderUniversityDetails,
    renderDocuments
  ];

  // Show student dashboard if registered
  if (studentData) {
    return (
      <div className="min-h-screen bg-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header with Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img
                src="./favicon.ico"
                alt="Dummy UniversityLogo"
                className="w-20 h-20 object-contain mr-6"
              />
              <div className="text-left">
                <h1 className="text-base font-medium text-blue-900 leading-tight">
                  Dummy University
                </h1>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Registration Status</h2>
              <p className="text-gray-600 text-sm">Welcome, {studentData.name}</p>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm text-center ${
                message.includes('successful') || message.includes('Welcome') || message.includes('updated')
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {message}
              </div>
            )}

            <div className="bg-blue-900 text-white p-4 rounded-lg mb-6 text-center">
              <p className="text-xs opacity-90 mb-1">Your Student ID</p>
              <div className="text-lg font-mono font-semibold tracking-wider">{studentData.studentId}</div>
            </div>

            {/* <div className="flex justify-center">
              <button
                onClick={checkStudentStatus}
                disabled={checkingStatus}
                className="bg-blue-900 hover:bg-blue-800 disabled:bg-gray-400 text-white px-6 py-3 rounded text-sm font-medium transition-colors"
              >
                {checkingStatus ? 'Checking...' : 'Check for Updates'}
              </button>
            </div> */}
          </div>
        </div>
        <ConfirmDialog />
        <LoadingPopup />
      </div>
    );
  }

  // Main registration form
  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Logo */}
        <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img
                src="./favicon.ico"
                alt="Dummy UniversityLogo"
                className="w-20 h-20 object-contain mr-6"
              />
              <div className="text-left">
                <h1 className="text-base font-medium text-blue-900 leading-tight">
                  Dummy University
                </h1>
              </div>
            </div>
          <h2 className="text-1xl font-bold text-gray-900 mt-4">Student Registration Form</h2>
          <p className="text-gray-600 mt-2 text-sm">Complete all sections to register for admission</p>
        </div>

        {/* Progress Bar */}
        {/* <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {formSteps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / formSteps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 shadow-inner">
            <div
              className="bg-blue-900 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / formSteps.length) * 100}%` }}
            ></div>
          </div>
        </div> */}

        {/* Step Navigation */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8 shadow-sm">
          {/* Mobile View */}
          <div className="block lg:hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStep + 1} of {formSteps.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(((currentStep + 1) / formSteps.length) * 100)}% Complete
              </span>
            </div>
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2 ${
                'bg-blue-900 text-white shadow-lg'
              }`}>
                {formSteps[currentStep]?.icon}
              </div>
              <div className="text-sm font-medium text-blue-900">
                {formSteps[currentStep]?.title}
              </div>
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden lg:flex items-center justify-between">
            {formSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                      index === currentStep
                        ? 'bg-blue-900 text-white shadow-lg'
                        : index < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-xs font-medium ${
                      index === currentStep
                        ? 'text-blue-900'
                        : index < currentStep
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < formSteps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 transition-all duration-200 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm border ${
            message.includes('successful') || message.includes('updated') || message.includes('verified')
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              <span className="mr-2">
                {message.includes('successful') || message.includes('updated') || message.includes('verified') ? '✅' : '⚠️'}
              </span>
              {message}
            </div>
          </div>
        )}

        {/* Current Step Header */}
        <div className="bg-blue-900 text-white p-6 rounded-t-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-2 flex items-center">
            <span className="w-10 h-10 bg-white bg-opacity-20 text-white rounded-full flex items-center justify-center text-lg mr-3 font-bold">
              {formSteps[currentStep]?.icon}
            </span>
            {formSteps[currentStep]?.title}
          </h3>
          <p className="text-blue-100 text-sm">
            Please fill in all required fields marked with *
          </p>
        </div>

        {/* Form Content */}
        <div className="bg-gray-50 p-6 rounded-b-lg shadow-sm">
          <div className="min-h-[500px]">
            {stepRenderers[currentStep]()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t border-gray-200 gap-4">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center px-4 sm:px-6 py-2 sm:py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium transition-colors w-full sm:w-auto justify-center bg-white shadow-sm"
            >
              <span className="mr-2">←</span>
              Previous
            </button>

            <div className="flex items-center space-x-1 sm:space-x-2 order-first sm:order-none">
              {formSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-blue-900 w-6 h-2'
                      : index < currentStep
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {currentStep === formSteps.length - 1 ? (
              <button
                onClick={handleRegistration}
                disabled={loading}
                className="flex items-center px-4 sm:px-8 py-2 sm:py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
              >
                <span className="hidden sm:inline">Complete Registration</span>
                <span className="sm:hidden">Complete</span>
                <span className="ml-2">✓</span>
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm w-full sm:w-auto justify-center"
              >
                Next
                <span className="ml-2">→</span>
              </button>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 p-6 rounded-lg text-center shadow-sm">
          <h4 className="font-semibold text-blue-900 mb-2">Need Help?</h4>
          <p className="text-sm text-blue-800">
            Contact the admissions office at{' '}
            <a href="mailto:admissions@enrollex.ac.in" className="font-mono underline hover:text-blue-600">
              admissions@enrollex.ac.in
            </a>{' '}
            or call{' '}
            <a href="tel:+918043434343" className="font-mono underline hover:text-blue-600">
              +91-703034343
            </a>
          </p>
          <p className="text-xs text-blue-700 mt-2">
            Office Hours: Monday to Friday, 9:00 AM to 5:00 PM
          </p>
        </div>

        {/* Data Privacy Notice */}
        <div className="mt-4 bg-gray-50 border border-gray-200 p-4 rounded-lg text-center">
          <p className="text-xs text-gray-600">
            Your data is secure and will be used only for admission purposes. 
            All information is stored locally in your browser and transmitted securely to our servers.
          </p>
        </div>
      </div>

      <ConfirmDialog />
      <LoadingPopup />
    </div>
  );
}