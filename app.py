"""
Screen Recorder Web Application
Local development version with SQLite metadata storage
"""

from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
import os
import io
import sqlite3
import base64
import hashlib
from datetime import datetime
from werkzeug.utils import secure_filename
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Cloudinary Configuration
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)

# Configuration
UPLOAD_FOLDER = 'recordings'
DATABASE_FILE = 'recordings/metadata.db'
ALLOWED_EXTENSIONS = {'webm', 'mp4', 'enc'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = None  # No file size limit

# Ensure recordings folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            original_name TEXT,
            file_size INTEGER,
            encrypted BOOLEAN DEFAULT FALSE,
            password_hash TEXT,
            salt TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()


# Initialize database on startup
init_db()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def derive_key(password: str, salt: bytes) -> bytes:
    """Derive encryption key from password"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def encrypt_file(data: bytes, password: str) -> tuple:
    """Encrypt file data with password"""
    salt = os.urandom(16)
    key = derive_key(password, salt)
    fernet = Fernet(key)
    encrypted = fernet.encrypt(data)
    return salt + encrypted, base64.b64encode(salt).decode()


def decrypt_file(encrypted_data: bytes, password: str) -> bytes:
    """Decrypt file data with password"""
    salt = encrypted_data[:16]
    data = encrypted_data[16:]
    key = derive_key(password, salt)
    fernet = Fernet(key)
    return fernet.decrypt(data)


@app.route('/')
def index():
    """Main recording page"""
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_recording():
    """Handle recording upload with optional encryption and cloud storage"""
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400
    
    file = request.files['video']
    password = request.form.get('password', '')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Generate unique filename with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_data = file.read()
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        if password:
            # Encrypt the file
            encrypted_data, salt_b64 = encrypt_file(file_data, password)
            filename = f'recording_{timestamp}.enc'
            
            # Check if Cloudinary is configured
            if os.getenv('CLOUDINARY_CLOUD_NAME'):
                # Upload to Cloudinary as a raw file (since it's encrypted)
                upload_result = cloudinary.uploader.upload(
                    io.BytesIO(encrypted_data),
                    resource_type="raw",
                    public_id=filename,
                    folder="recordings"
                )
                file_url = upload_result.get('secure_url')
            else:
                # Save locally
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                with open(filepath, 'wb') as f:
                    f.write(encrypted_data)
                file_url = None
            
            # Store metadata in database
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            cursor.execute('''
                INSERT INTO recordings (filename, original_name, file_size, encrypted, password_hash, salt)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (file_url or filename, file.filename, len(encrypted_data), True, password_hash, salt_b64))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'filename': filename,
                'url': file_url,
                'encrypted': True,
                'message': 'Recording saved with password protection!'
            })
        else:
            # Save without encryption
            filename = f'recording_{timestamp}.webm'
            
            if os.getenv('CLOUDINARY_CLOUD_NAME'):
                # Upload to Cloudinary as video
                upload_result = cloudinary.uploader.upload(
                    io.BytesIO(file_data),
                    resource_type="video",
                    public_id=filename.split('.')[0],
                    folder="recordings"
                )
                file_url = upload_result.get('secure_url')
            else:
                # Save locally
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                with open(filepath, 'wb') as f:
                    f.write(file_data)
                file_url = None
            
            # Store metadata in database
            cursor.execute('''
                INSERT INTO recordings (filename, original_name, file_size, encrypted)
                VALUES (?, ?, ?, ?)
            ''', (file_url or filename, file.filename, len(file_data), False))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'filename': filename,
                'url': file_url,
                'encrypted': False,
                'message': 'Recording saved successfully!'
            })
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/recordings')
def list_recordings():
    """List all saved recordings from database"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT filename, file_size, encrypted, created_at 
        FROM recordings 
        ORDER BY created_at DESC
    ''')
    
    rows = cursor.fetchall()
    recordings = []
    
    for row in rows:
        size = row['file_size']
        # Format size
        if size < 1024:
            size_str = f"{size} B"
        elif size < 1024 * 1024:
            size_str = f"{size / 1024:.1f} KB"
        else:
            size_str = f"{size / (1024 * 1024):.1f} MB"
        
        # Format date
        created = row['created_at']
        if created:
            date_str = created[:16].replace('T', ' ')
        else:
            date_str = ''
        
        filename = row['filename']
        # If it's a URL, get just the name for displaying
        display_name = filename.split('/')[-1] if 'http' in filename else filename
        
        recordings.append({
            'filename': filename,
            'display_name': display_name,
            'size': size_str,
            'date': date_str,
            'encrypted': bool(row['encrypted'])
        })
    
    conn.close()
    return jsonify(recordings)


@app.route('/recordings/<path:filename>')
def download_recording(filename):
    """Download a specific recording (unencrypted only)"""
    # Use path:filename to handle URLs if passed
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT encrypted FROM recordings WHERE filename = ?', (filename,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'File not found'}), 404
        
    if row['encrypted']:
        return jsonify({'error': 'This file is password protected. Use /decrypt endpoint.'}), 403
    
    if 'http' in filename:
        from flask import redirect
        return redirect(filename)
    
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)


@app.route('/decrypt/<path:filename>', methods=['POST'])
def decrypt_recording(filename):
    """Decrypt and download a password-protected recording"""
    password = request.json.get('password', '')
    
    if not password:
        return jsonify({'error': 'Password required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM recordings WHERE filename = ?', (filename,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'File not found'}), 404
    
    if not row['encrypted']:
        return jsonify({'error': 'File is not encrypted'}), 400
    
    # Verify password hash
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if password_hash != row['password_hash']:
        return jsonify({'error': 'Incorrect password'}), 401
    
    # Decrypt file
    try:
        if 'http' in filename:
            # Fetch from Cloudinary
            import requests
            response = requests.get(filename)
            encrypted_data = response.content
            download_name = filename.split('/')[-1].replace('.enc', '.webm')
        else:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            with open(filepath, 'rb') as f:
                encrypted_data = f.read()
            download_name = filename.replace('.enc', '.webm')
        
        decrypted_data = decrypt_file(encrypted_data, password)
        
        # Return decrypted file
        return send_file(
            io.BytesIO(decrypted_data),
            mimetype='video/webm',
            as_attachment=True,
            download_name=download_name
        )
    except Exception as e:
        return jsonify({'error': f'Decryption failed: {str(e)}'}), 500


@app.route('/verify-password/<filename>', methods=['POST'])
def verify_password(filename):
    """Verify password for a recording without downloading"""
    password = request.json.get('password', '')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT password_hash FROM recordings WHERE filename = ?', (filename,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'File not found'}), 404
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    if password_hash == row['password_hash']:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': 'Incorrect password'}), 401


@app.route('/delete/<filename>', methods=['DELETE'])
def delete_recording(filename):
    """Delete a recording"""
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Delete from database
        cursor.execute('DELETE FROM recordings WHERE filename = ?', (filename,))
        conn.commit()
        
        # Delete file
        if os.path.exists(filepath):
            os.remove(filepath)
        
        return jsonify({'success': True, 'message': 'Recording deleted'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/stats')
def get_stats():
    """Get storage statistics"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as count, SUM(file_size) as total_size FROM recordings')
    row = cursor.fetchone()
    conn.close()
    
    total_size = row['total_size'] or 0
    if total_size < 1024 * 1024:
        size_str = f"{total_size / 1024:.1f} KB"
    else:
        size_str = f"{total_size / (1024 * 1024):.1f} MB"
    
    return jsonify({
        'total_recordings': row['count'],
        'total_size': size_str
    })


if __name__ == '__main__':
    print("Screen Recorder Pro is running!")
    print("Open http://localhost:5000 in your browser")
    print(f"Database: {DATABASE_FILE}")
    print(f"Recordings folder: {UPLOAD_FOLDER}")
    app.run(debug=True, host='0.0.0.0', port=5000)
