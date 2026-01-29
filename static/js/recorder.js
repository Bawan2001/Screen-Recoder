/**
 * Screen Recorder Pro - Main JavaScript Module
 * Handles screen capture, recording, password protection, and file management
 */

class ScreenRecorder {
    constructor() {
        // DOM Elements
        this.preview = document.getElementById('preview');
        this.playback = document.getElementById('playback');
        this.placeholder = document.getElementById('placeholder');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.timer = document.getElementById('timer');
        this.recordingsList = document.getElementById('recordingsList');
        this.actionButtons = document.getElementById('actionButtons');

        // Buttons
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.saveProtectedBtn = document.getElementById('saveProtectedBtn');
        this.newBtn = document.getElementById('newBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.annotateBtn = document.getElementById('annotateBtn');

        // Toggles
        this.audioToggle = document.getElementById('audioToggle');
        this.micToggle = document.getElementById('micToggle');

        // Modal elements
        this.modal = document.getElementById('passwordModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.passwordInput = document.getElementById('passwordInput');
        this.confirmPassword = document.getElementById('confirmPassword');
        this.confirmGroup = document.getElementById('confirmGroup');
        this.modalConfirm = document.getElementById('modalConfirm');
        this.modalCancel = document.getElementById('modalCancel');
        this.modalClose = document.getElementById('modalClose');

        // State
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.audioStream = null;
        this.recordedBlob = null;
        this.isRecording = false;
        this.isPaused = false;
        this.timerInterval = null;
        this.startTime = 0;
        this.pausedTime = 0;
        this.captureSource = 'screen';

        // Annotation tools
        this.annotationTools = null;

        // Modal callback
        this.modalCallback = null;
        this.modalMode = 'set'; // 'set' or 'verify'

        this.init();
    }

    init() {
        // Bind event listeners
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadRecording());
        this.saveBtn.addEventListener('click', () => this.saveToServer());
        this.saveProtectedBtn.addEventListener('click', () => this.saveWithPassword());
        this.newBtn.addEventListener('click', () => this.newRecording());
        this.refreshBtn.addEventListener('click', () => this.loadRecordings());
        this.annotateBtn.addEventListener('click', () => this.toggleAnnotations());

        // Source selection
        document.querySelectorAll('.source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.captureSource = btn.dataset.source;
            });
        });

        // Modal events
        this.modalConfirm.addEventListener('click', () => this.handleModalConfirm());
        this.modalCancel.addEventListener('click', () => this.closeModal());
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Initialize annotation tools
        if (window.AnnotationTools) {
            this.annotationTools = new AnnotationTools();
        }

        // Load saved recordings
        this.loadRecordings();

        console.log('Screen Recorder Pro initialized');
    }

    async startRecording() {
        try {
            // Get screen stream with audio options
            const displayMediaOptions = {
                video: {
                    cursor: 'always'
                },
                audio: this.audioToggle.checked,
                preferCurrentTab: this.captureSource === 'tab'
            };

            // Add surface preferences based on capture source
            if (this.captureSource === 'screen') {
                displayMediaOptions.video.displaySurface = 'monitor';
            } else if (this.captureSource === 'window') {
                displayMediaOptions.video.displaySurface = 'window';
            }

            this.stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

            // Combine with microphone if enabled
            let combinedStream = this.stream;

            if (this.micToggle.checked) {
                try {
                    this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const audioTracks = this.audioStream.getAudioTracks();
                    const videoTracks = this.stream.getVideoTracks();
                    const screenAudioTracks = this.stream.getAudioTracks();

                    combinedStream = new MediaStream([
                        ...videoTracks,
                        ...screenAudioTracks,
                        ...audioTracks
                    ]);
                } catch (err) {
                    console.warn('Microphone access denied:', err);
                    this.showToast('Microphone access denied, continuing without mic', 'error');
                }
            }

            // Setup preview
            this.preview.srcObject = this.stream;
            this.preview.style.display = 'block';
            this.playback.style.display = 'none';
            this.placeholder.classList.add('hidden');

            // Handle stream end (user stops sharing)
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            });

            // Create MediaRecorder
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 5000000 // 5 Mbps for high quality
            });

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            // Start recording
            this.mediaRecorder.start(1000); // Capture every 1 second for unlimited recording
            this.isRecording = true;
            this.isPaused = false;

            // Update UI
            this.updateControls();
            this.startTimer();
            this.recordingIndicator.classList.add('active');
            this.recordingIndicator.classList.remove('paused');

            // Enable annotation button
            this.annotateBtn.disabled = false;

            this.showToast('Recording started!', 'success');

        } catch (err) {
            console.error('Error starting recording:', err);
            this.showToast('Could not start recording. Please allow screen sharing.', 'error');
        }
    }

    getSupportedMimeType() {
        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];

        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }

        return 'video/webm';
    }

    toggleAnnotations() {
        if (this.annotationTools) {
            this.annotationTools.toggle();
        }
    }

    togglePause() {
        if (!this.mediaRecorder) return;

        if (this.isPaused) {
            // Resume
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.pauseBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                <span>Pause</span>
            `;
            this.startTimer();
            this.recordingIndicator.classList.remove('paused');
            this.showToast('Recording resumed', 'success');
        } else {
            // Pause
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pausedTime = Date.now() - this.startTime;
            this.pauseBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Resume</span>
            `;
            this.stopTimer();
            this.recordingIndicator.classList.add('paused');
            this.showToast('Recording paused', 'success');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;

            // Stop all tracks
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            if (this.audioStream) {
                this.audioStream.getTracks().forEach(track => track.stop());
            }

            this.stopTimer();
            this.recordingIndicator.classList.remove('active', 'paused');

            // Hide annotations
            if (this.annotationTools) {
                this.annotationTools.hide();
            }
            this.annotateBtn.disabled = true;

            this.showToast('Recording stopped!', 'success');
        }
    }

    processRecording() {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.recordedBlob = blob;

        // Show playback
        const url = URL.createObjectURL(blob);
        this.playback.src = url;
        this.preview.style.display = 'none';
        this.playback.style.display = 'block';

        // Update controls
        this.updateControls();
    }

    updateControls() {
        if (this.isRecording) {
            this.startBtn.disabled = true;
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            this.actionButtons.style.display = 'none';
        } else if (this.recordedBlob) {
            this.startBtn.disabled = true;
            this.pauseBtn.disabled = true;
            this.stopBtn.disabled = true;
            this.actionButtons.style.display = 'flex';
        } else {
            this.startBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.stopBtn.disabled = true;
            this.actionButtons.style.display = 'none';
        }
    }

    startTimer() {
        if (!this.startTime || this.isPaused) {
            this.startTime = Date.now() - this.pausedTime;
        }

        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            this.timer.textContent = this.formatTime(elapsed);
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    downloadRecording() {
        if (!this.recordedBlob) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `screen_recording_${timestamp}.webm`;

        const url = URL.createObjectURL(this.recordedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Recording downloaded!', 'success');
    }

    async saveToServer(password = '') {
        if (!this.recordedBlob) return;

        const formData = new FormData();
        formData.append('video', this.recordedBlob, 'recording.webm');
        if (password) {
            formData.append('password', password);
        }

        try {
            this.saveBtn.disabled = true;
            this.saveProtectedBtn.disabled = true;

            const targetBtn = password ? this.saveProtectedBtn : this.saveBtn;
            const originalHTML = targetBtn.innerHTML;
            targetBtn.innerHTML = `
                <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
                <span>Saving...</span>
            `;

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                const msg = data.encrypted ? 'Recording saved with password protection!' : 'Recording saved to server!';
                this.showToast(msg, 'success');
                this.loadRecordings();
            } else {
                this.showToast(data.error || 'Failed to save recording', 'error');
            }

            targetBtn.innerHTML = originalHTML;
        } catch (err) {
            console.error('Error saving recording:', err);
            this.showToast('Failed to save recording', 'error');
        } finally {
            this.saveBtn.disabled = false;
            this.saveProtectedBtn.disabled = false;
        }
    }

    saveWithPassword() {
        this.openModal('set', (password) => {
            this.saveToServer(password);
        });
    }

    openModal(mode = 'set', callback = null) {
        this.modalMode = mode;
        this.modalCallback = callback;

        if (mode === 'set') {
            this.modalTitle.textContent = 'Set Password';
            this.confirmGroup.style.display = 'block';
        } else {
            this.modalTitle.textContent = 'Enter Password';
            this.confirmGroup.style.display = 'none';
        }

        this.passwordInput.value = '';
        this.confirmPassword.value = '';
        this.modal.classList.add('active');
        this.passwordInput.focus();
    }

    closeModal() {
        this.modal.classList.remove('active');
        this.modalCallback = null;
    }

    handleModalConfirm() {
        const password = this.passwordInput.value;

        if (!password) {
            this.showToast('Please enter a password', 'error');
            return;
        }

        if (this.modalMode === 'set') {
            const confirm = this.confirmPassword.value;
            if (password !== confirm) {
                this.showToast('Passwords do not match', 'error');
                return;
            }
        }

        if (this.modalCallback) {
            this.modalCallback(password);
        }

        this.closeModal();
    }

    newRecording() {
        // Reset everything
        this.recordedChunks = [];
        this.recordedBlob = null;
        this.startTime = 0;
        this.pausedTime = 0;

        // Reset UI
        this.preview.srcObject = null;
        this.preview.style.display = 'none';
        this.playback.src = '';
        this.playback.style.display = 'none';
        this.placeholder.classList.remove('hidden');
        this.timer.textContent = '00:00:00';

        // Reset pause button
        this.pauseBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <span>Pause</span>
        `;

        // Disable annotation button
        this.annotateBtn.disabled = true;

        // Clear annotations
        if (this.annotationTools) {
            this.annotationTools.clear();
            this.annotationTools.hide();
        }

        this.updateControls();
    }

    async loadRecordings() {
        try {
            const response = await fetch('/recordings');
            const recordings = await response.json();

            if (recordings.length === 0) {
                this.recordingsList.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                        <p>No recordings yet</p>
                    </div>
                `;
                return;
            }

            this.recordingsList.innerHTML = recordings.map(recording => `
                <div class="recording-item">
                    <div class="recording-icon ${recording.encrypted ? 'encrypted' : ''}">
                        ${recording.encrypted ? `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        ` : `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        `}
                    </div>
                    <div class="recording-info">
                        <div class="recording-name">
                            ${recording.filename}
                            ${recording.encrypted ? '<span class="lock-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>' : ''}
                        </div>
                        <div class="recording-meta">
                            <span>${recording.size}</span>
                            <span>${recording.date}</span>
                        </div>
                    </div>
                    <div class="recording-actions">
                        ${recording.encrypted ? `
                            <button class="btn btn-purple" onclick="recorder.downloadEncrypted('${recording.filename}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </button>
                        ` : `
                            <a href="/recordings/${recording.filename}" class="btn btn-success" download>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </a>
                        `}
                        <button class="btn btn-danger" onclick="recorder.deleteRecording('${recording.filename}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error loading recordings:', err);
        }
    }

    downloadEncrypted(filename) {
        this.openModal('verify', async (password) => {
            try {
                const response = await fetch(`/decrypt/${filename}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Handle base64 video response from Cloudinary
                    const a = document.createElement('a');
                    a.href = data.video;
                    a.download = data.filename || filename.replace('.enc', '.webm');
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    this.showToast('Recording downloaded!', 'success');
                } else if (response.ok) {
                    // Handle blob response (local storage)
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename.replace('.enc', '.webm');
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showToast('Recording downloaded!', 'success');
                } else {
                    this.showToast(data.error || 'Incorrect password', 'error');
                }
            } catch (err) {
                console.error('Error downloading encrypted file:', err);
                this.showToast('Failed to download recording', 'error');
            }
        });
    }

    async deleteRecording(filename) {
        if (!confirm(`Delete ${filename}?`)) return;

        try {
            const response = await fetch(`/delete/${filename}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Recording deleted!', 'success');
                this.loadRecordings();
            } else {
                this.showToast(data.error || 'Failed to delete recording', 'error');
            }
        } catch (err) {
            console.error('Error deleting recording:', err);
            this.showToast('Failed to delete recording', 'error');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.querySelector('.toast-message').textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize when DOM is loaded
let recorder;
document.addEventListener('DOMContentLoaded', () => {
    recorder = new ScreenRecorder();
});
