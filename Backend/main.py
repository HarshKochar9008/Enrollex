from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import uuid
from datetime import datetime, timedelta
import re
import os
import io
from werkzeug.exceptions import BadRequest
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import cloudinary
import cloudinary.uploader
import cloudinary.api
import jwt
from functools import wraps
from twilio.rest import Client
import random
from idcard import StudentIDCardGenerator, StudentDataFormatter
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Google Drive imports
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.service_account import Credentials

app = Flask(__name__)
application = app

# Configuration from environment variables
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
if not app.config['SECRET_KEY']:
    raise ValueError("SECRET_KEY environment variable is required")

app.config['MONGO_URI'] = os.getenv('MONGO_URI')
if not app.config['MONGO_URI']:
    raise ValueError("MONGO_URI environment variable is required")

# CORS configuration for frontend
CORS(app, resources={r"/api/*": {"origins": "*"}})

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_URI')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'student_registration')

# Validate required MongoDB config
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is required")

# Global variables for lazy connection (fork-safe)
_client = None
_db = None

def get_db():
    """Get database connection, initialize if needed (fork-safe)"""
    global _client, _db
    if _client is None:
        try:
            _client = MongoClient(MONGO_URI, connect=False)
            _db = _client[DATABASE_NAME]
            # Test the connection
            _client.admin.command('ping')
            print("[SUCCESS] Connected to MongoDB successfully")
        except Exception as e:
            print(f"[ERROR] Failed to connect to MongoDB: {e}")
            raise
    return _db

def get_collection(collection_name):
    """Get a specific collection from the database"""
    db = get_db()
    return db[collection_name]

# Helper functions to get specific collections
def get_students_collection():
    return get_collection('students')

def get_admins_collection():
    return get_collection('admins')

def get_otps_collection():
    return get_collection('otp')

def get_documents_collection():
    return get_collection('documents')

def get_admin_logs_collection():
    return get_collection('admin_logs')

def get_department_collection(department):
    """Get department-specific collection"""
    normalized_dept = normalize_department_name(department)
    return get_collection(normalized_dept)

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

# Validate Cloudinary config
if not all([os.getenv('CLOUDINARY_CLOUD_NAME'), os.getenv('CLOUDINARY_API_KEY'), os.getenv('CLOUDINARY_API_SECRET')]):
    print("Warning: Cloudinary configuration incomplete. File uploads may not work.")

# Google Drive Configuration
SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE', './credentials.json')
PARENT_FOLDER_ID = os.getenv('GOOGLE_DRIVE_PARENT_FOLDER_ID')

# Validate Google Drive config
if not PARENT_FOLDER_ID:
    print("Warning: GOOGLE_DRIVE_PARENT_FOLDER_ID not set. Document uploads may not work.")

# File configuration from environment
ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'pdf,png,jpg,jpeg').split(','))
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE_MB', '5')) * 1024 * 1024  # Convert MB to bytes

# Document types mapping for better organization
DOCUMENT_TYPES = {
    'aadhaarUpload': 'Aadhaar_Card',
    'tenthMarksheetUpload': '10th_Marksheet',
    'twelfthMarksheetUpload': '12th_Marksheet',
    'transferCertificateUpload': 'Transfer_Certificate',
    'conductCertificateUpload': 'Conduct_Certificate',
    'casteCertificateUpload': 'Caste_Certificate',
    'incomeCertificateUpload': 'Income_Certificate',
    'photographUpload': 'Passport_Photograph'
}

# JWT token expiration time from environment
JWT_EXPIRATION_HOURS = float(os.getenv('JWT_EXPIRATION_HOURS', '0.1'))
TOKEN_EXPIRATION = timedelta(hours=JWT_EXPIRATION_HOURS)

# Twilio Configuration
TWILIO_SID = os.getenv('TWILIO_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')

# Validate Twilio config
if not all([TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
    print("Warning: Twilio configuration incomplete. SMS/OTP functionality may not work.")

# Default admin configuration
DEFAULT_ADMIN_EMAIL = os.getenv('DEFAULT_ADMIN_EMAIL', 'superadmin@college.edu')
DEFAULT_ADMIN_PASSWORD = os.getenv('DEFAULT_ADMIN_PASSWORD', 'superadmin1234')

# Validate critical configurations on startup
def validate_config():
    """Validate that all critical environment variables are set"""
    required_vars = [
        'SECRET_KEY',
        'MONGO_URI'
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    print("✅ Configuration validation passed")

# Call validation on startup
validate_config()

# Google Drive Functions
def get_drive_service():
    """Create and return Google Drive API service"""
    try:
        credentials = Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES
        )
        print("Loaded service account:", credentials.service_account_email)

        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        print(f"Error creating Drive service: {e}")
        return None

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_ju_application_folder(service, ju_application_number, student_name):
    """Create a folder for student documents using JU application number"""
    try:
        # Create folder name with JU application number
        folder_name = f"JU_{ju_application_number}_{secure_filename(student_name)}"
        
        # Check if folder already exists
        results = service.files().list(
            q=f"name='{folder_name}' and parents in '{PARENT_FOLDER_ID}' and mimeType='application/vnd.google-apps.folder'",
            fields="files(id, name)"
        ).execute()
        
        items = results.get('files', [])
        
        if items:
            # Folder exists, return its ID
            print(f"JU Application folder already exists: {folder_name}")
            return items[0]['id']
        else:
            # Create new folder
            folder_metadata = {
                'name': folder_name,
                'parents': [PARENT_FOLDER_ID],
                'mimeType': 'application/vnd.google-apps.folder',
                'description': f"Documents for JU Application: {ju_application_number}, Student: {student_name}, Created: {datetime.now().isoformat()}"
            }
            
            folder = service.files().create(body=folder_metadata, fields='id').execute()
            print(f"Created JU Application folder: {folder_name} with ID: {folder.get('id')}")
            return folder.get('id')
            
    except Exception as e:
        print(f"Error creating JU Application folder: {e}")
        return None

def upload_single_document(service, file_data, filename, parent_folder_id, document_type):
    """Upload a single document to Google Drive"""
    try:
        # Determine MIME type
        file_extension = filename.rsplit('.', 1)[1].lower()
        mime_types = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png'
        }
        mime_type = mime_types.get(file_extension, 'application/octet-stream')
        
        # Get document display name
        doc_display_name = DOCUMENT_TYPES.get(document_type, document_type)
        
        # Create filename with document type
        clean_filename = f"{doc_display_name}.{file_extension}"
        
        # File metadata
        file_metadata = {
            'name': clean_filename,
            'parents': [parent_folder_id],
            'description': f"Document type: {doc_display_name}, Original filename: {filename}, Upload time: {datetime.now().isoformat()}"
        }
        
        # Create media upload object
        media = MediaIoBaseUpload(
            io.BytesIO(file_data),
            mimetype=mime_type,
            resumable=True
        )
        
        # Upload file
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,name,webViewLink,webContentLink,size'
        ).execute()
        
        # Make file publicly viewable (optional - adjust permissions as needed)
        try:
            permission = {
                'role': 'reader',
                'type': 'anyone'
            }
            service.permissions().create(
                fileId=uploaded_file.get('id'),
                body=permission
            ).execute()
        except Exception as perm_error:
            print(f"Permission setting warning: {perm_error}")
        
        print(f"Document uploaded successfully: {clean_filename} with ID: {uploaded_file.get('id')}")
        
        return {
            'file_id': uploaded_file.get('id'),
            'file_name': uploaded_file.get('name'),
            'web_view_link': uploaded_file.get('webViewLink'),
            'download_link': uploaded_file.get('webContentLink'),
            'original_name': filename,
            'document_type': document_type,
            'file_size': uploaded_file.get('size'),
            'upload_success': True
        }
        
    except Exception as e:
        print(f"Error uploading document {document_type}: {e}")
        return {
            'document_type': document_type,
            'original_name': filename,
            'upload_success': False,
            'error': str(e)
        }

def process_student_documents(service, documents_data, ju_application_number, student_name):
    """Process and upload all student documents"""
    try:
        print(f"Processing documents for JU Application: {ju_application_number}")
        
        # Create student folder
        student_folder_id = create_ju_application_folder(service, ju_application_number, student_name)
        if not student_folder_id:
            return {
                'success': False,
                'error': 'Failed to create student folder',
                'uploaded_documents': {},
                'failed_documents': []
            }
        
        uploaded_documents = {}
        failed_documents = []
        upload_results = []
        
        # Loop through each document type
        for doc_type, file_info in documents_data.items():
            if file_info and isinstance(file_info, dict):
                print(f"Processing {doc_type}...")
                
                try:
                    # Get file data
                    file_data = file_info.get('file_data')
                    filename = file_info.get('filename')
                    
                    if not file_data or not filename:
                        print(f"Skipping {doc_type} - missing file data or filename")
                        continue
                    
                    # Convert array back to bytes if needed
                    if isinstance(file_data, list):
                        file_data = bytes(file_data)
                    
                    # Validate file
                    if not allowed_file(filename):
                        print(f"Skipping {doc_type} - invalid file type: {filename}")
                        failed_documents.append({
                            'document_type': doc_type,
                            'filename': filename,
                            'error': 'Invalid file type'
                        })
                        continue
                    
                    if len(file_data) > MAX_FILE_SIZE:
                        print(f"Skipping {doc_type} - file too large: {len(file_data)} bytes")
                        failed_documents.append({
                            'document_type': doc_type,
                            'filename': filename,
                            'error': 'File too large (>5MB)'
                        })
                        continue
                    
                    # Upload document
                    upload_result = upload_single_document(
                        service, 
                        file_data, 
                        filename, 
                        student_folder_id, 
                        doc_type
                    )
                    
                    upload_results.append(upload_result)
                    
                    if upload_result.get('upload_success'):
                        uploaded_documents[doc_type] = {
                            'file_id': upload_result['file_id'],
                            'file_name': upload_result['file_name'],
                            'web_view_link': upload_result['web_view_link'],
                            'download_link': upload_result['download_link'],
                            'original_name': upload_result['original_name'],
                            'file_size': upload_result['file_size']
                        }
                        print(f"Successfully uploaded {doc_type}")
                    else:
                        failed_documents.append({
                            'document_type': doc_type,
                            'filename': filename,
                            'error': upload_result.get('error', 'Unknown error')
                        })
                        print(f" Failed to upload {doc_type}: {upload_result.get('error')}")
                
                except Exception as doc_error:
                    print(f"Error processing {doc_type}: {doc_error}")
                    failed_documents.append({
                        'document_type': doc_type,
                        'filename': file_info.get('filename', 'Unknown'),
                        'error': str(doc_error)
                    })
        
        # Summary
        total_processed = len(uploaded_documents) + len(failed_documents)
        print(f"Document processing complete: {len(uploaded_documents)} uploaded, {len(failed_documents)} failed out of {total_processed} total")
        
        return {
            'success': True,
            'student_folder_id': student_folder_id,
            'uploaded_documents': uploaded_documents,
            'failed_documents': failed_documents,
            'upload_summary': {
                'total_processed': total_processed,
                'successful_uploads': len(uploaded_documents),
                'failed_uploads': len(failed_documents)
            }
        }
        
    except Exception as e:
        print(f"Error in process_student_documents: {e}")
        return {
            'success': False,
            'error': str(e),
            'uploaded_documents': {},
            'failed_documents': []
        }

# Utility functions
def generate_student_id():
    """Generate a unique student ID"""
    return f"STU{uuid.uuid4().hex[:8].upper()}"

def generate_application_number():
    """Generate application number when status progresses"""
    return f"APP{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"

def validate_email(email):
    """Validate email format"""
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """Validate phone number (basic validation)"""
    return phone.isdigit() and len(phone) >= 10

def normalize_department_name(department):
    """Normalize department name for collection naming"""
    return department.strip().lower().replace("_", "").replace(" ","")

# Authentication decorator
def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer token
            except IndexError:
                return jsonify({'success': False, 'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'success': False, 'error': 'Token is missing'}), 401
        
        try:
            # Decode token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_admin = get_admins_collection().find_one({'_id': ObjectId(data['admin_id'])})
            
            if not current_admin:
                return jsonify({'success': False, 'error': 'Invalid token'}), 401
            
            # Remove password from admin object
            current_admin['_id'] = str(current_admin['_id'])
            current_admin.pop('password', None)
            
            # Pass current admin to the route
            request.current_admin = current_admin
            
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'success': False, 'error': 'Token validation failed'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

# Super admin only decorator
def super_admin_required(f):
    @wraps(f)
    @auth_required
    def decorated_function(*args, **kwargs):
        if request.current_admin.get('role') != 'super_admin':
            return jsonify({'success': False, 'error': 'Super admin access required'}), 403
        return f(*args, **kwargs)
    
    return decorated_function

def validate_student_data(data):
    """Enhanced validation function for comprehensive student data"""
    # Essential required fields
    required_fields = ['studentFullName', 'department']
    
    # Check required fields
    for field in required_fields:
        if not data.get(field) or not str(data.get(field)).strip():
            print(f"Missing required field: {field}")
            return f"Missing required field: {field}"
    
    # Validate email (either official or personal should be provided)
    student_email = data.get('studentOfficialEmail') or data.get('studentEmail')
    if not student_email or not str(student_email).strip():
        print("Student email is required")
        return "Student email is required"
    
    # Basic email format validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, student_email.strip()):
        print(f"Invalid email format: {student_email}")
        return "Invalid email format"
    
    print("Validation passed successfully")
    return None  # No validation errors

# API Routes
@app.route('/')
def index():
    return {"message": "Student Registration API with Flask, MongoDB & Google Drive", "status": "running"}

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint that verifies configuration"""
    try:
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'services': {}
        }
        
        # Check MongoDB connection
        try:
            db = get_db()
            db.command('ping')
            health_status['services']['mongodb'] = 'connected'
        except Exception as e:
            health_status['services']['mongodb'] = f'error: {str(e)}'
            health_status['status'] = 'degraded'
        
        # Check Cloudinary configuration
        try:
            if all([os.getenv('CLOUDINARY_CLOUD_NAME'), os.getenv('CLOUDINARY_API_KEY'), os.getenv('CLOUDINARY_API_SECRET')]):
                health_status['services']['cloudinary'] = 'configured'
            else:
                health_status['services']['cloudinary'] = 'not configured'
                health_status['status'] = 'degraded'
        except Exception as e:
            health_status['services']['cloudinary'] = f'error: {str(e)}'
        
        # Check Google Drive configuration
        try:
            if PARENT_FOLDER_ID and os.path.exists(SERVICE_ACCOUNT_FILE):
                health_status['services']['google_drive'] = 'configured'
            else:
                health_status['services']['google_drive'] = 'not configured'
                health_status['status'] = 'degraded'
        except Exception as e:
            health_status['services']['google_drive'] = f'error: {str(e)}'
        
        # Check Twilio configuration
        try:
            if all([TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
                health_status['services']['twilio'] = 'configured'
            else:
                health_status['services']['twilio'] = 'not configured'
                health_status['status'] = 'degraded'
        except Exception as e:
            health_status['services']['twilio'] = f'error: {str(e)}'
        
        return jsonify(health_status), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/api/students/register', methods=['POST'])
def register_student():
    """Register a new student with comprehensive details and Google Drive document uploads"""
    try:
        # Get JSON data
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        print(f"Registration request received for: {data.get('studentFullName', 'Unknown')}")
        
        # Validate input data
        validation_error = validate_student_data(data)
        if validation_error:
            return jsonify({"success": False, "error": validation_error}), 400
        
        # Check if JU application number is provided (make it optional for now)
        ju_application = data.get('juApplication', '').strip()
        if not ju_application:
            # Generate a temporary JU application number if not provided
            ju_application = f"TEMP_{uuid.uuid4().hex[:8].upper()}"
            print(f"Generated temporary JU application: {ju_application}")
        
        department = normalize_department_name(data.get('department', ''))
        print(f"Normalized department name: {department}")
        students_dept_collection = get_department_collection(department)
        
        # Check if email already exists
        student_email = data.get('studentOfficialEmail') or data.get('studentEmail', '').strip().lower()
        
        # FIXED: Use get_db() instead of global db variable
        if department in get_db().list_collection_names():
            existing_student = get_students_collection().find_one({"email": student_email})
        else:
            existing_student = None

        if existing_student:
            return jsonify({"success": False, "error": "Email already registered"}), 400
        
        existing_dept_student = students_dept_collection.find_one({"email": student_email})
        if existing_dept_student:
            return jsonify({"success": False, "error": "Email already registered in department"}), 400
        
        # Check if JU application number already exists (only if it's not a temp one)
        if not ju_application.startswith('TEMP_'):
            existing_ju_student = students_dept_collection.find_one({"juApplication": ju_application})
            if existing_ju_student:
                return jsonify({"success": False, "error": "JU Application number already registered"}), 400
        
        # Generate unique student ID
        student_id = generate_student_id()
        
        # Process documents if provided
        documents_upload_result = {}
        print(data.get('documenst'))
        if data.get('documents'):
            print("Processing document uploads...")
            
            # Get Google Drive service
            drive_service = get_drive_service()
            if drive_service:
                documents_data = data.get('documents', {})
                student_name = data.get('studentFullName', 'Unknown')
                
                # Process documents
                upload_result = process_student_documents(
                    drive_service, 
                    documents_data, 
                    ju_application, 
                    student_name
                )
                
                documents_upload_result = upload_result
                print(f"Document upload result: {upload_result.get('upload_summary', {})}")
            else:
                print("Google Drive service unavailable - skipping document upload")
        
        # Prepare comprehensive student document for department collection
        student_doc = {
            # Generated fields
            "student_id": student_id,
            "status": "pending",
            "attendance": "absent",
            "has_photo": bool(data.get('photographUpload')),
            "application_number": None,
            "registration_date": datetime.now().isoformat(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            
            # Personal Information
            "studentFullName": data.get('studentFullName', '').strip(),
            "name": data.get('studentFullName', '').strip(),  # For backward compatibility
            "gender": data.get('gender', '').strip(),
            "dateOfBirth": data.get('dateOfBirth', ''),
            "dob": data.get('dateOfBirth', ''),  # For backward compatibility
            "bloodGroup": data.get('bloodGroup', '').strip(),
            "nationality": data.get('nationality', 'Indian').strip(),
            "religion": data.get('religion', '').strip(),
            "caste": data.get('caste', '').strip(),
            "motherTongue": data.get('motherTongue', '').strip(),
            "category": data.get('category', '').strip(),
            "birthPlace": data.get('birthPlace', '').strip(),
            
            # Contact Information
            "studentContactNo": data.get('studentContactNo', '').strip(),
            "phone": data.get('studentContactNo', '').strip(),  # For backward compatibility
            "studentEmail": data.get('studentEmail', '').strip().lower(),
            "email": student_email,  # Primary email for lookups
            "parentContactNo": data.get('parentContactNo', '').strip(),
            
            # Address Information
            "correspondenceAddress": data.get('correspondenceAddress', '').strip(),
            "correspondenceCity": data.get('correspondenceCity', '').strip(),
            "correspondenceState": data.get('correspondenceState', '').strip(),
            "correspondenceCountry": data.get('correspondenceCountry', 'India').strip(),
            "correspondencePostalCode": data.get('correspondencePostalCode', '').strip(),
            "permanentAddress": data.get('permanentAddress', '').strip(),
            "permanentCity": data.get('permanentCity', '').strip(),
            "permanentState": data.get('permanentState', '').strip(),
            "permanentCountry": data.get('permanentCountry', 'India').strip(),
            "permanentPostalCode": data.get('permanentPostalCode', '').strip(),
            
            # Academic Information - 10th
            "tenthMarksCardNumber": data.get('tenthMarksCardNumber', '').strip(),
            "tenthBoardUniversity": data.get('tenthBoardUniversity', '').strip(),
            "tenthSchoolName": data.get('tenthSchoolName', '').strip(),
            "tenthSchoolState": data.get('tenthSchoolState', '').strip(),
            "tenthPassedOutYear": data.get('tenthPassedOutYear', ''),
            "tenthTotalMarks": data.get('tenthTotalMarks', ''),
            "tenthScoredMarks": data.get('tenthScoredMarks', ''),
            "tenthPercentage": data.get('tenthPercentage', ''),
            
            # Academic Information - 12th
            "collegeInstitutionName": data.get('collegeInstitutionName', '').strip(),
            "collegeStateName": data.get('collegeStateName', '').strip(),
            "boardUniversity": data.get('boardUniversity', '').strip(),
            "twelfthMarksCardNumber": data.get('twelfthMarksCardNumber', '').strip(),
            "twelfthRegisterNumber": data.get('twelfthRegisterNumber', '').strip(),
            "twelfthPassedOutYear": data.get('twelfthPassedOutYear', ''),
            "twelfthTotalMarks": data.get('twelfthTotalMarks', ''),
            "twelfthScoredMarks": data.get('twelfthScoredMarks', ''),
            "twelfthPercentage": data.get('twelfthPercentage', ''),
            
            # Subject-wise Marks
            "pcmTotal": data.get('pcmTotal', ''),
            "pcmPercentage": data.get('pcmPercentage', ''),
            "physicsTotal": data.get('physicsTotal', ''),
            "physicsScored": data.get('physicsScored', ''),
            "chemistryTotal": data.get('chemistryTotal', ''),
            "chemistryScored": data.get('chemistryScored', ''),
            "mathematicsTotal": data.get('mathematicsTotal', ''),
            "mathematicsScored": data.get('mathematicsScored', ''),
            "biologyTotal": data.get('biologyTotal', ''),
            "biologyScored": data.get('biologyScored', ''),
            "computerScienceTotal": data.get('computerScienceTotal', ''),
            "computerScienceScored": data.get('computerScienceScored', ''),
            "englishTotal": data.get('englishTotal', ''),
            "englishScored": data.get('englishScored', ''),
            "languageType": data.get('languageType', '').strip(),
            "languageTotal": data.get('languageTotal', ''),
            "languageScored": data.get('languageScored', ''),
            "additionalLanguage": data.get('additionalLanguage', '').strip(),
            "additionalLanguageTotal": data.get('additionalLanguageTotal', ''),
            "additionalLanguageScored": data.get('additionalLanguageScored', ''),
            
            # Parent/Guardian Information
            "fatherName": data.get('fatherName', '').strip(),
            "fatherOccupation": data.get('fatherOccupation', '').strip(),
            "fatherIncome": data.get('fatherIncome', ''),
            "fatherMobile": data.get('fatherMobile', '').strip(),
            "motherName": data.get('motherName', '').strip(),
            "motherOccupation": data.get('motherOccupation', '').strip(),
            "motherIncome": data.get('motherIncome', ''),
            "motherMobile": data.get('motherMobile', '').strip(),
            "parentEmail": data.get('parentEmail', '').strip().lower(),
            "parent_name": data.get('fatherName', '').strip(),  # For backward compatibility
            "parent_email": data.get('parentEmail', '').strip().lower(),  # For backward compatibility
            "parent_phone": data.get('fatherMobile', '').strip(),  # For backward compatibility
            "guardianName": data.get('guardianName', '').strip(),
            "guardianOccupation": data.get('guardianOccupation', '').strip(),
            "guardianIncome": data.get('guardianIncome', ''),
            
            # University/Admission Details
            "department": data.get('department', '').strip(),
            "programName": data.get('programName', '').strip(),
            "admissionType": data.get('admissionType', '').strip(),
            "juApplication": ju_application,
            "studentAadhaar": data.get('studentAadhaar', '').strip(),
            
            # Document Upload Information (Google Drive)
            "documentsFolder": documents_upload_result.get('student_folder_id'),
            "uploadedDocuments": documents_upload_result.get('uploaded_documents', {}),
            "failedDocuments": documents_upload_result.get('failed_documents', []),
            "documentUploadSummary": documents_upload_result.get('upload_summary', {}),
            
            # Legacy document fields (for backward compatibility)
            "aadhaarUpload": documents_upload_result.get('uploaded_documents', {}).get('aadhaarUpload', {}).get('file_id'),
            "tenthMarksheetUpload": documents_upload_result.get('uploaded_documents', {}).get('tenthMarksheetUpload', {}).get('file_id'),
            "twelfthMarksheetUpload": documents_upload_result.get('uploaded_documents', {}).get('twelfthMarksheetUpload', {}).get('file_id'),
            "transferCertificateUpload": documents_upload_result.get('uploaded_documents', {}).get('transferCertificateUpload', {}).get('file_id'),
            "conductCertificateUpload": documents_upload_result.get('uploaded_documents', {}).get('conductCertificateUpload', {}).get('file_id'),
            "casteCertificateUpload": documents_upload_result.get('uploaded_documents', {}).get('casteCertificateUpload', {}).get('file_id'),
            "incomeCertificateUpload": documents_upload_result.get('uploaded_documents', {}).get('incomeCertificateUpload', {}).get('file_id'),
            "photographUpload": documents_upload_result.get('uploaded_documents', {}).get('photographUpload', {}).get('file_id')
        }
        
        # Store in main students collection for tracking
        student_main_record = {
            "department": data.get('department', '').strip(),
            "student_id": student_id,
            "email": student_email,
            "juApplication": ju_application,
            "created_at": datetime.utcnow()
        }
        
        # Insert into main collection
        get_students_collection().insert_one(student_main_record)
        print(f"Student main record created: {student_id}")
        
        # Insert into department collection
        result = students_dept_collection.insert_one(student_doc)
        
        if result.inserted_id:
            response_data = {
                "success": True,
                "studentId": student_id,
                "juApplication": ju_application,
                "data": {
                    "studentFullName": data.get('studentFullName', ''),
                    "name": data.get('studentFullName', ''),  # For backward compatibility
                    "department": data.get('department', ''),
                    "email": student_email,
                    "studentContactNo": data.get('studentContactNo', ''),
                    "admissionType": data.get('admissionType', ''),
                    "programName": data.get('programName', '')
                },
                "documentUpload": {
                    "folderId": documents_upload_result.get('student_folder_id'),
                    "uploadedCount": len(documents_upload_result.get('uploaded_documents', {})),
                    "failedCount": len(documents_upload_result.get('failed_documents', [])),
                    "summary": documents_upload_result.get('upload_summary', {})
                },
                "message": "Registration successful"
            }
            
            print(f"Registration successful for {student_id} - JU: {ju_application}")
            return jsonify(response_data), 201
        else:
            return jsonify({"success": False, "error": "Failed to save student data"}), 500
            
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/students/status', methods=['POST'])
def check_student_status():
    """Check student status and return updated information"""
    try:
        data = request.get_json()
        
        if not data or 'studentId' not in data:
            return jsonify({"success": False, "error": "Student ID required"}), 400
        
        student_id = data['studentId']
        
        # Find student in main collection to get department
        dept_details = get_students_collection().find_one({"student_id": student_id})
        if not dept_details:
            return jsonify({"success": False, "error": "Student not found"}), 404

        department = normalize_department_name(dept_details['department'])
        students_dept_collection = get_department_collection(department)

        # Find student in department collection
        student = students_dept_collection.find_one({"student_id": student_id})
        if not student:
            return jsonify({"success": False, "error": "Student not found in department records"}), 404
        
        # Return student data
        return jsonify({
            "success": True,
            "student": {
                "name": student.get("name") or student.get("studentFullName"),
                "studentId": student["student_id"],
                "department": student["department"],
                "status": student["status"],
                "hasPhoto": student.get("has_photo", False),
                "applicationNumber": student.get("application_number"),
                "registrationDate": student["registration_date"]
            }
        }), 200
        
    except Exception as e:
        print(f"Status check error: {e}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/students', methods=['GET'])
def get_all_students():
    """Get all students with pagination and filtering"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        status_filter = request.args.get('status')
        department_filter = request.args.get('department')
        has_photo_filter = request.args.get('hasPhoto')
        search_query = request.args.get('search')
        sort_by = request.args.get('sortBy', 'registration_date')
        sort_order = request.args.get('sortOrder', 'desc')
        
        # Build filter query
        filter_query = {}
        
        # Department filter
        if department_filter:
            filter_query['department'] = department_filter
        
        # Search filter for main collection
        if search_query:
            search_regex = {"$regex": search_query, "$options": "i"}
            filter_query["$or"] = [
                {"student_id": search_regex},
                {"department": search_regex}
            ]
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get total count from main collection
        total_students = get_students_collection().count_documents(filter_query)
        
        # Set sort order
        sort_direction = -1 if sort_order == 'desc' else 1
        
        # Get students from main collection with pagination
        students_cursor = get_students_collection().find(
            filter_query,
            {
                "_id": 0,
                "student_id": 1,
                "department": 1,
            }
        ).sort("created_at", sort_direction).skip(skip).limit(limit)

        students = []
        for details in students_cursor:

            department = normalize_department_name(details["department"])
            students_dept_collection = get_department_collection(department)
            student = students_dept_collection.find_one({"student_id": details['student_id']})

            if not student:
                continue  # skip if not found in department collection

            # Apply additional filters
            if status_filter and student.get("status") != status_filter:
                continue
            if has_photo_filter is not None and student.get("has_photo", False) != (has_photo_filter.lower() == 'true'):
                continue

            students.append({
                "studentId": student["student_id"],
                "name": student.get("name") or student.get("studentFullName"),
                "email": student["email"],
                "phone": student.get("phone") or student.get("studentContactNo", ""),
                "department": student["department"],
                "attendance":student["attendance"],
                "status": student["status"],
                "hasPhoto": student.get("has_photo", False),
                "applicationNumber": student.get("application_number"),
                "registrationDate": student["registration_date"],
                "dob": student.get("dob") or student.get("dateOfBirth", ""),
                "parentName": student.get("parent_name") or student.get("fatherName", ""),
                "parentEmail": student.get("parent_email") or student.get("parentEmail", ""),
                "parentPhone": student.get("parent_phone") or student.get("fatherMobile", ""),
                "createdAt": student.get("created_at"),
                "updatedAt": student.get("updated_at"),
                "juApplication": student.get("juApplication"),
                "documentsFolder": student.get("documentsFolder"),
                "documentUploadSummary": student.get("documentUploadSummary", {})
            })
        
        # Calculate pagination info
        total_pages = (total_students + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1

        
        return jsonify({
            "success": True,
            "students": students,
            "pagination": {
                "currentPage": page,
                "totalPages": total_pages,
                "totalStudents": total_students,
                "studentsPerPage": limit,
                "hasNext": has_next,
                "hasPrev": has_prev
            },
            "filters": {
                "status": status_filter,
                "department": department_filter,
                "hasPhoto": has_photo_filter,
                "search": search_query
            }
        }), 200
        
    except Exception as e:
        print(f"Get all students error: {e}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/students/department/<department>/pending-verification', methods=['GET'])
def get_students_by_department(department):
    """Get all students in a specific department"""
    try:
        department_normalized = normalize_department_name(department)
        students_dept_collection = get_department_collection(department)
        
        students = list(students_dept_collection.find({}, {
            "_id": 0,
            "student_id": 1,
            "name": 1,
            "studentFullName": 1,
            "email": 1,
            "phone": 1,
            "studentContactNo": 1,
            "status": 1,
            "application_number": 1,
            "registration_date": 1,
            "juApplication": 1,
            "documentsFolder": 1,
            "attendance": 1,
        }))

        # Normalize the response for backward compatibility
        for student in students:
            if not student.get('name') and student.get('studentFullName'):
                student['name'] = student['studentFullName']
            if not student.get('phone') and student.get('studentContactNo'):
                student['phone'] = student['studentContactNo']

        return jsonify({
            "success": True,
            "students": students
        }), 200
        
    except Exception as e:
        print(f"Get students by department error: {e}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

def sendid(student_id):
    """
    Generate ID card for a verified student.
    
    Args:
        student_id (str): The student ID to generate card for
    
    Returns:
        dict: Result containing success status and file path
    """
    try:
        print(f"Starting ID card generation for student: {student_id}")
        
        # Fetch student data from database
        student_data = fetch_student_data_for_id_card(student_id)
        if not student_data:
            return {"success": False, "error": "Student data not found"}
        print(student_data)
        # Initialize ID card generator with custom paths if needed
        generator = StudentIDCardGenerator(
            template_path='./Jain.pptx',
            output_folder='./generated_id_cards'
        )
        
        # Generate the ID card
        result = generator.generate_id_card(student_data)
        
        if result['success']:
            print(f"ID card generated successfully: {result['file_path']}")
            
            # Optional: Log ID card generation to database
            log_id_card_generation(student_id, result)
            
            return result
        else:
            print(f"ID card generation failed: {result['error']}")
            return result
            
    except Exception as e:
        print(f"Error in sendid function: {e}")
        return {"success": False, "error": str(e)}


def fetch_student_data_for_id_card(student_id):
    """
    Fetch and format student data for ID card generation.
    
    Args:
        student_id (str): Student ID to fetch
        
    Returns:
        dict: Formatted student data or None if not found
    """
    try:
        # Get student record from main students collection
        student_record = get_students_collection().find_one({"student_id": student_id})
        if not student_record:
            print(f"Student record not found for ID: {student_id}")
            return None
        
        # Get additional details from department collection
        department = normalize_department_name(student_record['department'])
        dept_collection = get_department_collection(department)
        dept_record = dept_collection.find_one({"student_id": student_id})
        
        if not dept_record:
            print(f"Department record not found for student: {student_id}")
            return None
        
        # Use the data formatter to create properly formatted data
        formatted_data = StudentDataFormatter.format_student_data(
            student_record, 
            dept_record
        )
        
        print(f"Student data formatted for ID card: {formatted_data.get('name')}")
        return dept_record
        
    except Exception as e:
        print(f"Error fetching student data for ID card: {e}")
        return None


def log_id_card_generation(student_id, generation_result):
    """
    Log ID card generation event to database.
    
    Args:
        student_id (str): Student ID
        generation_result (dict): Result from ID card generation
    """
    try:
        # Create log entry
        log_entry = {
            "student_id": student_id,
            "generated_at": datetime.utcnow(),
            "file_path": generation_result.get('file_path'),
            "format": generation_result.get('format', 'unknown'),
            "success": generation_result.get('success', False),
            "message": generation_result.get('message', ''),
            "error": generation_result.get('error', None)
        }
        
        # Save to ID card log collection (create if doesn't exist)
        get_id_card_log_collection().insert_one(log_entry)
        print(f"ID card generation logged for student: {student_id}")
        
    except Exception as e:
        print(f"Error logging ID card generation: {e}")


def get_id_card_log_collection():
    """Get the ID card generation log collection."""
    return get_collection('id_card_generation_logs')


@app.route('/api/students/<student_id>/documents', methods=['POST', 'PUT'])
def upload_student_documents(student_id):
    """
    Handle student document verification and trigger ID card generation.
    """
    try:
        data = request.get_json()
        
        # Validate presence of 'documents' and 'departmentAdmin'
        if not data or 'documents' not in data or 'departmentAdmin' not in data:
            return jsonify({
                "success": False, 
                "error": "Missing documents or departmentAdmin field"
            }), 400
        
        documents = data['documents']
        verified_by = data['departmentAdmin']
        
        # Normalize and update document data
        for doc_name, doc_info in documents.items():
            if doc_info.get('verified'):
                documents[doc_name]['verifiedAt'] = datetime.utcnow().isoformat()
                documents[doc_name]['verifiedBy'] = verified_by
            else:
                documents[doc_name]['verifiedAt'] = None
                documents[doc_name]['verifiedBy'] = None
        
        # Define required documents to be verified
        required_docs = [
            '10th_marksheet',
            '12th_marksheet',
            'transfer_certificate',
            'character_certificate',
            'aadhar_card',
            'passport_photos'
        ]
        
        all_required_verified = all(
            documents.get(doc, {}).get('verified', False) for doc in required_docs
        )
        
        # Upsert document data into 'documents' collection
        get_documents_collection().update_one(
            {"student_id": student_id},
            {
                "$set": {
                    "student_id": student_id,
                    "documents": documents,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # If all main documents verified, update status and generate ID card
        id_card_result = None
        if all_required_verified:
            # Get student's department from the central "students" collection
            student_record = get_students_collection().find_one({"student_id": student_id})
            if not student_record:
                return jsonify({
                    "success": False, 
                    "error": "Student record not found"
                }), 404
            
            department = normalize_department_name(student_record['department'])
            students_dept_collection = get_department_collection(department)
            
            # Update status in the corresponding department collection
            update_result = students_dept_collection.update_one(
                {"student_id": student_id},
                {"$set": {"status": "verified", "updated_at": datetime.utcnow()}}
            )
            
            # Generate ID card using the imported module
            print(f"All documents verified for {student_id}, generating ID card...")
            id_card_result = sendid(student_id)
            
            if update_result.modified_count:
                print(f"Student {student_id} status updated to 'verified' in {department}")
            else:
                print(f"Student {student_id} found but status not updated")
        
        # Prepare response
        response_data = {
            "success": True,
            "message": "Document verification data saved successfully.",
            "allRequiredDocumentsVerified": all_required_verified,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add ID card generation result to response
        if id_card_result:
            response_data["idCardGeneration"] = {
                "attempted": True,
                "success": id_card_result.get("success", False),
                "message": id_card_result.get("message", ""),
                "file_path": id_card_result.get("file_path", ""),
                "format": id_card_result.get("format", ""),
                "error": id_card_result.get("error", None)
            }
        else:
            response_data["idCardGeneration"] = {
                "attempted": False,
                "reason": "Not all required documents verified"
            }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Document upload error: {e}")
        return jsonify({
            "success": False, 
            "error": "Internal server error",
            "timestamp": datetime.utcnow().isoformat()
        }), 500


@app.route('/api/students/<student_id>/documents', methods=['GET'])
def get_student_documents(student_id):
    try:
        # Attempt to retrieve document data from 'documents' collection
        document_data = get_documents_collection().find_one({"student_id": student_id})
        department=get_students_collection().find_one({"student_id": student_id}).get("department", "")
        document_links=get_department_collection(normalize_department_name(department)).find_one({"student_id": student_id})
        if document_links and "_id" in document_links:
            document_links["_id"] = str(document_links["_id"])

        if not document_data:
            return jsonify({"success": False, "error": "No document data found"}), 404

        # Remove MongoDB's internal ObjectId before sending response
        document_data["_id"] = str(document_data["_id"])

        return jsonify({"success": True, "data": document_data, "links":document_links}), 200

    except Exception as e:
        print(f"Document fetch error: {e}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/students/upload-photo', methods=['POST'])
def upload_student_photo():
    try:
        student_id = request.form.get('studentId')
        file = request.files.get('photo')

        if not student_id or not file:
            return jsonify({"success": False, "error": "Missing studentId or photo"}), 400

        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            file,
            folder="student_photos/",
            public_id=student_id,
            overwrite=True,
            resource_type="image"
        )

        photo_url = result.get("secure_url")
        print(f"Photo uploaded successfully: {photo_url}")
        
        # Update the student's document in the correct department collection
        student_doc = get_students_collection().find_one({"student_id": student_id})
        print(f"Found student document: {student_doc}")
        if not student_doc:
            return jsonify({"success": False, "error": "Student not found"}), 404

        department = normalize_department_name(student_doc.get('department', ''))
        students_dept_collection = get_department_collection(department)
        print(f"Updating student in department: {department}")

        update_result = students_dept_collection.update_one(
            {"student_id": student_id},
            {
                "$set": {
                    "has_photo": True,
                    "status": "photo_uploaded",
                    "photo_url": photo_url,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if update_result.modified_count == 0:
            return jsonify({"success": False, "error": "Failed to update student record"}), 500

        return jsonify({"success": True, "url": photo_url}), 200

    except Exception as e:
        print(f"Photo upload error: {e}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

# Admin Authentication Routes
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    try:
        data = request.get_json()
        email = data.get('email', '').lower()
        password = data.get('password', '')
        remember_me = data.get('rememberMe', False)
        
        # Validate input
        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400
        
        # Find admin by email
        admin = get_admins_collection().find_one({'email': email})
        
        if not admin:
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        
        # Check password
        if not check_password_hash(admin['password'], password):
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        
        # Check if admin is active
        if not admin.get('isActive', True):
            return jsonify({'success': False, 'error': 'Account is inactive'}), 401
        
        # Update last login
        get_admins_collection().update_one(
            {'_id': admin['_id']},
            {'$set': {'lastLogin': datetime.utcnow()}}
        )
        
        # Generate JWT token
        token_expiration = timedelta(days=30) if remember_me else TOKEN_EXPIRATION
        token = jwt.encode({
            'admin_id': str(admin['_id']),
            'email': admin['email'],
            'role': admin['role'],
            'exp': datetime.utcnow() + token_expiration
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        # Prepare admin data (remove sensitive info)
        admin_data = {
            '_id': str(admin['_id']),
            'name': admin['name'],
            'email': admin['email'],
            'role': admin['role'],
            'department': admin.get('department'),
            'permissions': admin.get('permissions', [])
        }
        
        return jsonify({
            'success': True,
            'token': token,
            'admin': admin_data
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admins', methods=['GET'])
@super_admin_required
def get_admins():
    try:
        # Get all admins
        admins = list(get_admins_collection().find())
        
        # Format admin data
        formatted_admins = []
        for admin in admins:
            formatted_admins.append({
                '_id': str(admin['_id']),
                'name': admin['name'],
                'email': admin['email'],
                'role': admin['role'],
                'department': admin.get('department'),
                'permissions': admin.get('permissions', []),
                'isActive': admin.get('isActive', True),
                'createdAt': admin.get('createdAt', datetime.utcnow()),
                'createdBy': admin.get('createdBy', 'System'),
                'lastLogin': admin.get('lastLogin')
            })
        
        return jsonify({
            'success': True,
            'admins': formatted_admins
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admins/stats', methods=['GET'])
@super_admin_required
def get_admin_stats():
    try:
        # Get counts by role
        total_admins = get_admins_collection().count_documents({})
        super_admins = get_admins_collection().count_documents({'role': 'super_admin'})
        department_admins = get_admins_collection().count_documents({'role': 'department_admin'})
        photo_admins = get_admins_collection().count_documents({'role': 'photo_admin'})
        
        return jsonify({
            'success': True,
            'stats': {
                'totalAdmins': total_admins,
                'superAdmins': super_admins,
                'departmentAdmins': department_admins,
                'photoAdmins': photo_admins
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admins', methods=['POST'])
@super_admin_required
def create_admin():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'password', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400
        
        email = data['email'].lower()
        
        # Check if email already exists
        existing_admin = get_admins_collection().find_one({'email': email})
        if existing_admin:
            return jsonify({'success': False, 'error': 'Email already exists'}), 400
        
        # Validate password length
        if len(data['password']) < 8:
            return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
        
        # Validate role
        valid_roles = ['super_admin', 'department_admin', 'photo_admin']
        if data['role'] not in valid_roles:
            return jsonify({'success': False, 'error': 'Invalid role'}), 400
        
        # Validate department for department admin
        if data['role'] == 'department_admin' and not data.get('department'):
            return jsonify({'success': False, 'error': 'Department is required for department admin'}), 400
        
        # Hash password
        hashed_password = generate_password_hash(data['password'])
        
        # Create admin document
        new_admin = {
            'name': data['name'],
            'email': email,
            'password': hashed_password,
            'role': data['role'],
            'department': normalize_department_name(data.get('department')) if data.get('department') else None,
            'permissions': data.get('permissions', []),
            'isActive': True,
            'createdAt': datetime.utcnow(),
            'createdBy': request.current_admin['email'],
            'lastLogin': None
        }
        
        # Insert admin
        result = get_admins_collection().insert_one(new_admin)
        
        # Log admin creation
        get_admin_logs_collection().insert_one({
            'action': 'admin_created',
            'adminId': str(result.inserted_id),
            'performedBy': request.current_admin['email'],
            'timestamp': datetime.utcnow(),
            'details': {
                'name': new_admin['name'],
                'email': new_admin['email'],
                'role': new_admin['role']
            }
        })
        
        return jsonify({
            'success': True,
            'message': 'Admin created successfully',
            'adminId': str(result.inserted_id)
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admins/<admin_id>', methods=['DELETE'])
@super_admin_required
def delete_admin(admin_id):
    try:
        # Validate ObjectId
        try:
            admin_obj_id = ObjectId(admin_id)
        except:
            return jsonify({'success': False, 'error': 'Invalid admin ID'}), 400
        
        # Check if admin exists
        admin = get_admins_collection().find_one({'_id': admin_obj_id})
        if not admin:
            return jsonify({'success': False, 'error': 'Admin not found'}), 404
        
        # Prevent self-deletion
        if str(admin['_id']) == request.current_admin['_id']:
            return jsonify({'success': False, 'error': 'Cannot delete your own account'}), 400
        
        # Delete admin
        result = get_admins_collection().delete_one({'_id': admin_obj_id})
        
        if result.deleted_count == 0:
            return jsonify({'success': False, 'error': 'Failed to delete admin'}), 500
        
        # Log admin deletion
        get_admin_logs_collection().insert_one({
            'action': 'admin_deleted',
            'adminId': admin_id,
            'performedBy': request.current_admin['email'],
            'timestamp': datetime.utcnow(),
            'details': {
                'name': admin['name'],
                'email': admin['email'],
                'role': admin['role']
            }
        })
        
        return jsonify({
            'success': True,
            'message': 'Admin deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admins/<admin_id>', methods=['PUT'])
@super_admin_required
def update_admin(admin_id):
    try:
        # Validate ObjectId
        try:
            admin_obj_id = ObjectId(admin_id)
        except:
            return jsonify({'success': False, 'error': 'Invalid admin ID'}), 400
        
        # Check if admin exists
        admin = get_admins_collection().find_one({'_id': admin_obj_id})
        if not admin:
            return jsonify({'success': False, 'error': 'Admin not found'}), 404
        
        data = request.get_json()
        
        # Prepare update fields
        update_fields = {}
        
        # Update allowed fields
        if 'name' in data:
            update_fields['name'] = data['name']
        
        if 'email' in data:
            email = data['email'].lower()
            # Check if new email already exists
            existing = get_admins_collection().find_one({'email': email, '_id': {'$ne': admin_obj_id}})
            if existing:
                return jsonify({'success': False, 'error': 'Email already exists'}), 400
            update_fields['email'] = email
        
        if 'password' in data and data['password']:
            if len(data['password']) < 8:
                return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
            update_fields['password'] = generate_password_hash(data['password'])
        
        if 'role' in data:
            valid_roles = ['super_admin', 'department_admin', 'photo_admin']
            if data['role'] not in valid_roles:
                return jsonify({'success': False, 'error': 'Invalid role'}), 400
            update_fields['role'] = data['role']
        
        if 'department' in data:
            update_fields['department'] = normalize_department_name(data['department']) if data['department'] else None
        
        if 'permissions' in data:
            update_fields['permissions'] = data['permissions']
        
        if 'isActive' in data:
            update_fields['isActive'] = data['isActive']
        
        # Update admin
        update_fields['updatedAt'] = datetime.utcnow()
        update_fields['updatedBy'] = request.current_admin['email']
        
        get_admins_collection().update_one(
            {'_id': admin_obj_id},
            {'$set': update_fields}
        )
        
        # Log admin update
        get_admin_logs_collection().insert_one({
            'action': 'admin_updated',
            'adminId': admin_id,
            'performedBy': request.current_admin['email'],
            'timestamp': datetime.utcnow(),
            'details': {
                'updatedFields': list(update_fields.keys())
            }
        })
        
        return jsonify({
            'success': True,
            'message': 'Admin updated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/init-admin', methods=['POST'])
def init_admin():
    try:
        # Check if any admin exists
        admin_count = get_admins_collection().count_documents({})
        if admin_count > 0:
            return jsonify({'success': False, 'error': 'Admins already exist'}), 400
        
        # Create default super admin using environment variables
        default_admin = {
            'name': 'Super Admin',
            'email': DEFAULT_ADMIN_EMAIL,
            'password': generate_password_hash(DEFAULT_ADMIN_PASSWORD),
            'role': 'super_admin',
            'department': None,
            'permissions': ['all'],
            'isActive': True,
            'createdAt': datetime.utcnow(),
            'createdBy': 'System',
            'lastLogin': None
        }
        
        result = get_admins_collection().insert_one(default_admin)
        
        return jsonify({
            'success': True,
            'message': 'Default super admin created',
            'credentials': {
                'email': DEFAULT_ADMIN_EMAIL,
                'password': '*** Please check your environment variables ***'
            },
            'warning': 'Please change the default password immediately after first login'
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/department-stats/<department>', methods=['GET'])
@auth_required
def get_department_stats(department):
    try:
        # Check if admin has access to this department
        if request.current_admin['role'] == 'department_admin':
            if request.current_admin.get('department') != normalize_department_name(department):
                return jsonify({'success': False, 'error': 'Access denied'}), 403
        elif request.current_admin['role'] != 'super_admin':
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        department_normalized = normalize_department_name(department)
        students_dept_collection = get_department_collection(department)
        
        # Get statistics
        total_students = students_dept_collection.count_documents({})
        pending_verification = students_dept_collection.count_documents({'status': 'photo_uploaded'})
        completed_verification = students_dept_collection.count_documents({'status': 'verified'})
        
        # Get today's completions
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_completed = students_dept_collection.count_documents({
            'status': 'verified',
            'updated_at': {'$gte': today_start}
        })
        
        completion_rate = 0
        if total_students > 0:
            completion_rate = round((completed_verification / total_students) * 100, 2)
        
        return jsonify({
            'success': True,
            'statistics': {
                'overview': {
                    'totalStudents': total_students,
                    'pendingVerification': pending_verification,
                    'completedVerification': completed_verification,
                    'completionRate': completion_rate,
                    'todayCompleted': today_completed
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/verify-token', methods=['GET'])
@auth_required
def verify_token():
    try:
        return jsonify({
            'success': True,
            'admin': request.current_admin
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/departments', methods=['GET'])
def get_departments():
    try:
        # Get unique departments from students collection
        departments = get_students_collection().distinct('department')
        
        return jsonify({
            'success': True,
            'departments': departments
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Google Drive specific routes
@app.route('/api/google-drive/test', methods=['GET'])
def test_google_drive():
    """Test Google Drive connection"""
    try:
        service = get_drive_service()
        if not service:
            return jsonify({
                'success': False,
                'error': 'Failed to connect to Google Drive'
            }), 500
        
        # Test listing parent folder
        results = service.files().list(
            q=f"parents in '{PARENT_FOLDER_ID}'",
            fields="files(id, name)",
            pageSize=5
        ).execute()
        
        files = results.get('files', [])
        
        return jsonify({
            'success': True,
            'message': 'Google Drive connection successful',
            'parentFolderId': PARENT_FOLDER_ID,
            'filesInParentFolder': len(files),
            'sampleFiles': [f['name'] for f in files[:3]]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Google Drive test failed: {str(e)}'
        }), 500

@app.route('/api/google-drive/folders/<student_id>', methods=['GET'])
def get_student_drive_folder(student_id):
    """Get Google Drive folder for a specific student"""
    try:
        # Find student in main collection
        student_record = get_students_collection().find_one({"student_id": student_id})
        if not student_record:
            return jsonify({"success": False, "error": "Student not found"}), 404
        
        # Get student from department collection
        department = normalize_department_name(student_record['department'])
        students_dept_collection = get_department_collection(department)
        student = students_dept_collection.find_one({"student_id": student_id})
        
        if not student:
            return jsonify({"success": False, "error": "Student not found in department"}), 404
        
        folder_id = student.get('documentsFolder')
        uploaded_docs = student.get('uploadedDocuments', {})
        
        if not folder_id:
            return jsonify({
                "success": True,
                "message": "No Google Drive folder created yet",
                "folderId": None,
                "documents": {}
            }), 200
        
        return jsonify({
            "success": True,
            "folderId": folder_id,
            "juApplication": student.get('juApplication'),
            "documents": uploaded_docs,
            "documentUploadSummary": student.get('documentUploadSummary', {})
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# OTP Generator
def generate_otp(length=6):
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])

# Send OTP via SMS
def send_otp_via_sms(phone_number, otp):
    """Send OTP via SMS using Twilio"""
    if not all([TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        raise ValueError("Twilio configuration is incomplete")
    
    client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
    print(f"Sending OTP to: {phone_number}")
    
    message = client.messages.create(
        body=f"Your verification code is {otp}. Do not share this with anyone.",
        from_=TWILIO_PHONE_NUMBER,
        to=phone_number
    )
    return message.sid

@app.route('/api/send-otp', methods=['GET','POST'])
def otp():
    try:
        data = request.get_json()
        print(data)

        user_phone = data.get('phoneNumber')

        otp = generate_otp()
        print(f"Generated OTP: {otp}")
        message_id = send_otp_via_sms(user_phone, otp)
        print("OTP sent successfully!")
        otp_document = {
            "phone": user_phone,
            "otp": otp,
            "created_at": datetime.utcnow()
        }

        # Store OTP in MongoDB (optional, for verification later)
        otp_collection = get_otps_collection()
        otp_collection.insert_one(otp_document)        
        return jsonify({
            "success": True,
            "message": "OTP sent successfully",
            "otp": otp,  # For testing purposes, you might want to remove this in production
            "messageId": message_id
        }), 200
    
    except Exception as e:
        print(f"Error sending OTP: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to send OTP"
        }), 500

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.get_json()
        print(data)
        user_phone = data.get('phoneNumber')
        otp = data.get('otp')

        if not user_phone or not otp:
            return jsonify({"success": False, "error": "Phone number and OTP are required"}), 400

        # Fetch the OTP from the database
        otp_collection = get_otps_collection()
        otp_record = otp_collection.find_one({"phone": user_phone, "otp": otp})

        if not otp_record:
            return jsonify({"success": False, "error": "Invalid OTP"}), 400

        # Optionally, you can delete the OTP after successful verification
        otp_collection.delete_one({"_id": otp_record["_id"]})

        return jsonify({"success": True, "message": "OTP verified successfully"}), 200

    except Exception as e:
        print(f"Error verifying OTP: {e}")
        return jsonify({"success": False, "error": "Failed to verify OTP"}), 500

@app.route("/api/attendance/mark", methods=['POST'])
def mark():
    data = request.get_json()
    student_id = data.get('studentId')
    department = data.get('department')
    status = data.get('status')

    student_dept = get_department_collection(department)
    student_record = student_dept.find_one({"student_id": student_id})
    if not student_record:
        return jsonify({"success": False, "error": "Student not found"}), 404
    # Update attendance status
    update_result = student_dept.update_one(
        {"student_id": student_id},
        {"$set": {"attendance": status}}
    )

    if update_result.modified_count == 0:
        return jsonify({"success": False, "error": "Failed to update attendance status"}), 500
    return jsonify({"success": True, "message": "Attendance status updated successfully"}), 200

# Add these imports at the top of your file if not already present
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import tempfile

@app.route('/api/students/<student_id>/print-document', methods=['GET'])
def generate_admission_document(student_id):
    """Generate provisional admission document PDF for verified student"""
    try:
        # Find student in main collection
        student_record = get_students_collection().find_one({"student_id": student_id})
        if not student_record:
            return jsonify({"success": False, "error": "Student not found"}), 404

        # Get student from department collection
        department = normalize_department_name(student_record['department'])
        students_dept_collection = get_department_collection(department)
        student = students_dept_collection.find_one({"student_id": student_id})
        
        if not student:
            return jsonify({"success": False, "error": "Student not found in department"}), 404

        # Check if student is verified
        if student.get('status') not in ['verified', 'documents_verified']:
            return jsonify({
                "success": False, 
                "error": "Student must be verified before generating document"
            }), 400

        # Check if admission slip already exists
        existing_slip = student.get('admission_slip_file_id')
        if existing_slip and student.get('admission_slip_link'):
            return jsonify({
                "success": True,
                "message": "Admission slip already generated",
                "documentUrl": student.get('admission_slip_link'),
                "fileId": existing_slip,
                "generatedAt": student.get('admission_slip_generated_at'),
                "action": "open_existing"
            }), 200

        # Get document verification data
        document_data = get_documents_collection().find_one({"student_id": student_id})
        if not document_data:
            return jsonify({
                "success": False, 
                "error": "No document verification data found"
            }), 404

        # Generate PDF
        pdf_path = generate_admission_pdf(student, document_data)
        
        if not pdf_path:
            return jsonify({
                "success": False, 
                "error": "Failed to generate PDF document"
            }), 500

        # Upload to Google Drive
        drive_upload_result = upload_admission_pdf_to_drive(pdf_path, student)
        
        if not drive_upload_result or not drive_upload_result.get('upload_success'):
            return jsonify({
                "success": False, 
                "error": "Failed to upload document to Google Drive"
            }), 500

        # Return success response with Google Drive link
        return jsonify({
            "success": True,
            "message": "Admission slip generated successfully",
            "documentUrl": drive_upload_result.get('web_view_link'),
            "downloadUrl": drive_upload_result.get('download_link'),
            "fileId": drive_upload_result.get('file_id'),
            "fileName": drive_upload_result.get('file_name'),
            "generatedAt": datetime.utcnow().isoformat(),
            "action": "open_new"
        }), 200

    except Exception as e:
        print(f"Error generating admission document: {e}")
        return jsonify({
            "success": False, 
            "error": "Internal server error"
        }), 500

def generate_admission_pdf(student, document_data):
    """Generate the provisional admission PDF document"""
    try:
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        pdf_path = temp_file.name
        temp_file.close()

        # Create PDF document
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )

        # Build content
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=14,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.black
        )
        
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=10
        )

        # Add Jain University Logo
        try:
            # You need to save the logo image file in your project directory
            # Save the logo as 'jain_logo.png' in the same directory as your app.py
            logo_path = './jain_logo.png'  # Update this path as needed
            
            if os.path.exists(logo_path):
                logo = Image(logo_path)
                # Resize logo to appropriate size (adjust as needed)
                logo.drawHeight = 1*inch
                logo.drawWidth = 6*inch  # Maintain aspect ratio
                logo.hAlign = 'CENTER'
                story.append(logo)
                story.append(Spacer(1, 20))
            else:
                # Fallback to text if logo file not found
                story.append(Paragraph("JAIN DEEMED-TO-BE UNIVERSITY", title_style))
                story.append(Paragraph("FACULTY OF ENGINEERING AND TECHNOLOGY", header_style))
                story.append(Spacer(1, 12))
                print("Warning: Logo file not found, using text header")
        
        except Exception as logo_error:
            print(f"Error loading logo: {logo_error}")
            # Fallback to text header
            story.append(Paragraph("JAIN DEEMED-TO-BE UNIVERSITY", title_style))
            story.append(Paragraph("FACULTY OF ENGINEERING AND TECHNOLOGY", header_style))
            story.append(Spacer(1, 12))

        # Document type boxes (JET, SCR, MGMT, UNI-GAUGE, JEE)
        boxes_data = [['JET', 'SCR', 'MGMT', 'UNI-GAUGE', 'JEE']]
        boxes_table = Table(boxes_data, colWidths=[1*inch]*5)
        boxes_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOX', (0, 0), (-1, -1), 2, colors.black),
        ]))
        story.append(boxes_table)
        story.append(Spacer(1, 12))

        # Main title
        main_title = "PROVISIONAL ADMISSION-CUM-ACKNOWLEDGEMENT SLIP FOR THE ACADEMIC YEAR 2025-2026"
        story.append(Paragraph(main_title, title_style))
        story.append(Spacer(1, 12))

        # Student information paragraph
        student_name = student.get('studentFullName', student.get('name', ''))
        parent_name = student.get('fatherName', student.get('parent_name', ''))
        department_name = student.get('department', '')
        
        student_info = f"Mr. / Ms. <u>{student_name}</u> son/daughter of Mr. / Ms. <u>{parent_name}</u> is provisionally admitted to I / III Semester B.Tech or Lateral Entry Program in <u>{department_name}</u> branch for the academic year 2025-2026."
        
        story.append(Paragraph(student_info, styles['Normal']))
        story.append(Spacer(1, 20))

        # Documents table
        documents_verified = document_data.get('documents', {})
        
        # Document mapping - Updated to match your verification system
        doc_mapping = {
            'Provisional Admission Order (PAO)': 'pao',
            '10th / S.S.L.C Marks Card': '10th_marksheet',
            '12th / PUC / Diploma Marks Card': '12th_marksheet',
            'Equivalence Certificate': 'equivalence_certificate',
            'Caste Cum/ Income Certificate': 'caste_certificate',
            'Transfer Certificate': 'transfer_certificate',
            'Migration Certificate': 'migration_certificate',
            '6 Passport Size colour photos': 'passport_photos',
            'Self-attested copy of PAN Card of Student / Parent': 'pan_card',
            'Self-attested copy of Aadhar Card of Student': 'aadhar_card'
        }

        # Create table data
        table_data = [['S.No', 'DOCUMENTS COLLECTED', 'ORIGINAL', 'XEROX']]
        
        for i, (doc_name, doc_key) in enumerate(doc_mapping.items(), 1):
            # Check if document is verified (mark as collected)
            is_verified = documents_verified.get(doc_key, {}).get('verified', False)
            original_mark = '✓' if is_verified else ''
            xerox_mark = '✓' if is_verified else ''
            
            table_data.append([str(i), doc_name, original_mark, xerox_mark])

        # Create and style the table
        doc_table = Table(table_data, colWidths=[0.5*inch, 4*inch, 1*inch, 1*inch])
        doc_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),  # Header row
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),      # Data rows
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOX', (0, 0), (-1, -1), 2, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),  # Center checkboxes
        ]))
        
        story.append(doc_table)
        story.append(Spacer(1, 20))

        # Acknowledgment text
        ack_text = "The above information is correct and I have taken a copy of this letter."
        story.append(Paragraph(ack_text, styles['Normal']))
        story.append(Spacer(1, 20))

        # Signature line
        signature_text = "Signature of the student with date: _________________________________"
        story.append(Paragraph(signature_text, styles['Normal']))
        story.append(Spacer(1, 20))

        # Important notes
        notes_title = Paragraph("<b>Important Note:</b>", styles['Normal'])
        story.append(notes_title)
        
        notes = [
            "1. Provisional Admission has been granted based on the above referred documents submitted to us and it is strictly subject to the approval of the Jain University. The documents submitted will be sent to concerned Board/University for verification purpose. If the Board/University is found as unrecognized or certificate/marks card submitted by the student is fake, the Provisional Admission made will automatically get cancelled.",
            "2. You are requested to submit the pending original documents (marked as \"P\") within one month from this date, failing which the University will not approve the admission for want of documents resulting the admission, is liable for cancellation.",
            "3. As per the Notification from Income Tax Office, it is mandatory for every student/ parent of the student (as applicable) who is admitted to this University to produce a self-attested copy of the PAN & Aadhar Card."
        ]
        
        for note in notes:
            story.append(Paragraph(note, styles['Normal']))
            story.append(Spacer(1, 10))

        # Footer with date and signature
        story.append(Spacer(1, 30))
        
        # Create footer table
        current_date = datetime.now().strftime("%d/%m/%Y")
        footer_data = [[f"Date: {current_date}", "Authorized Signatory"]]
        footer_table = Table(footer_data, colWidths=[3*inch, 3*inch])
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        story.append(footer_table)

        # Add final line
        story.append(Spacer(1, 10))
        story.append(Paragraph("Faculty of Engineering and Technology", 
                              ParagraphStyle('Footer', parent=styles['Normal'], 
                                           alignment=TA_RIGHT, fontSize=9)))

        # Build PDF
        doc.build(story)
        
        print(f"PDF generated successfully at: {pdf_path}")
        return pdf_path

    except Exception as e:
        print(f"Error generating PDF: {e}")
        return None

def upload_admission_pdf_to_drive(pdf_path, student):
    """Upload generated admission PDF to Google Drive"""
    try:
        drive_service = get_drive_service()
        if not drive_service:
            print("Google Drive service not available")
            return None

        # Get student's existing folder or create new one
        student_folder_id = student.get('documentsFolder')
        if not student_folder_id:
            ju_application = student.get('juApplication', student.get('student_id'))
            student_name = student.get('studentFullName', student.get('name', 'Unknown'))
            student_folder_id = create_ju_application_folder(drive_service, ju_application, student_name)

        if not student_folder_id:
            print("Could not create/find student folder")
            return None

        # Upload PDF
        with open(pdf_path, 'rb') as pdf_file:
            file_data = pdf_file.read()

        filename = f"Admission_Slip_{student.get('student_id')}.pdf"
        
        upload_result = upload_single_document(
            drive_service,
            file_data,
            filename,
            student_folder_id,
            'admission_slip'
        )

        if upload_result.get('upload_success'):
            print(f"PDF uploaded to Drive: {upload_result.get('web_view_link')}")
            
            # Update student record with admission slip info
            department = normalize_department_name(student.get('department', ''))
            students_dept_collection = get_department_collection(department)
            
            students_dept_collection.update_one(
                {"student_id": student.get('student_id')},
                {
                    "$set": {
                        "admission_slip_generated": True,
                        "admission_slip_file_id": upload_result.get('file_id'),
                        "admission_slip_link": upload_result.get('web_view_link'),
                        "admission_slip_download_link": upload_result.get('download_link'),
                        "admission_slip_generated_at": datetime.utcnow()
                    }
                }
            )
            
            return upload_result
        else:
            print(f"Failed to upload PDF to Drive: {upload_result.get('error')}")
            return None

    except Exception as e:
        print(f"Error uploading PDF to Drive: {e}")
        return None
    finally:
        # Clean up temporary file after upload
        try:
            if os.path.exists(pdf_path):
                os.unlink(pdf_path)
                print(f"Cleaned up temporary file: {pdf_path}")
        except Exception as e:
            print(f"Error cleaning up temporary file: {e}")

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'success': False, 'error': 'Bad request'}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)