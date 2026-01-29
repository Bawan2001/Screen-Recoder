/**
 * Annotation Tools Module
 * Provides drawing and annotation capabilities during screen recording
 */

class AnnotationTools {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#ff0000';
        this.brushSize = 4;
        this.lastX = 0;
        this.lastY = 0;
        this.annotations = [];
        this.isActive = false;

        this.init();
    }

    init() {
        this.createCanvas();
        this.createToolbar();
        this.bindEvents();
    }

    createCanvas() {
        // Create canvas overlay
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'annotationCanvas';
        this.canvas.className = 'annotation-canvas';

        const container = document.getElementById('videoContainer');
        container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('videoContainer');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.redraw();
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.id = 'annotationToolbar';
        toolbar.className = 'annotation-toolbar';
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <button class="tool-btn active" data-tool="pen" title="Pen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="highlighter" title="Highlighter">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l-6 6v3h9l3-3"></path>
                        <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="arrow" title="Arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="rectangle" title="Rectangle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="circle" title="Circle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="eraser" title="Eraser">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.4 2.8c.8-.8 2-.8 2.8 0L21 7.6c.8.8.8 2 0 2.8L12 19"></path>
                    </svg>
                </button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-section colors">
                <button class="color-btn active" data-color="#ff0000" style="background: #ff0000" title="Red"></button>
                <button class="color-btn" data-color="#00ff00" style="background: #00ff00" title="Green"></button>
                <button class="color-btn" data-color="#0088ff" style="background: #0088ff" title="Blue"></button>
                <button class="color-btn" data-color="#ffff00" style="background: #ffff00" title="Yellow"></button>
                <button class="color-btn" data-color="#ff00ff" style="background: #ff00ff" title="Magenta"></button>
                <button class="color-btn" data-color="#ffffff" style="background: #ffffff" title="White"></button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-section">
                <label class="brush-size-label">
                    <span>Size:</span>
                    <input type="range" id="brushSize" min="1" max="20" value="4" class="brush-slider">
                    <span id="brushSizeValue">4</span>
                </label>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-section">
                <button class="tool-btn" id="undoBtn" title="Undo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 7v6h6"></path>
                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                    </svg>
                </button>
                <button class="tool-btn" id="clearBtn" title="Clear All">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <button class="tool-btn close-btn" id="closeAnnotations" title="Close Annotations">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        document.querySelector('.container').appendChild(toolbar);
        this.toolbar = toolbar;
    }

    bindEvents() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(touch);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.draw(touch);
        });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });

        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = btn.dataset.color;
            });
        });

        // Brush size
        const brushSlider = document.getElementById('brushSize');
        const brushValue = document.getElementById('brushSizeValue');
        brushSlider.addEventListener('input', () => {
            this.brushSize = parseInt(brushSlider.value);
            brushValue.textContent = this.brushSize;
        });

        // Undo
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());

        // Clear
        document.getElementById('clearBtn').addEventListener('click', () => this.clear());

        // Close
        document.getElementById('closeAnnotations').addEventListener('click', () => this.hide());
    }

    startDrawing(e) {
        if (!this.isActive) return;

        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;

        // For shapes, store starting point
        this.startX = this.lastX;
        this.startY = this.lastY;

        // Start new annotation
        this.currentAnnotation = {
            tool: this.currentTool,
            color: this.currentColor,
            size: this.brushSize,
            points: [{ x: this.lastX, y: this.lastY }]
        };
    }

    draw(e) {
        if (!this.isDrawing || !this.isActive) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        switch (this.currentTool) {
            case 'pen':
                this.ctx.strokeStyle = this.currentColor;
                this.ctx.globalAlpha = 1;
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                break;

            case 'highlighter':
                this.ctx.strokeStyle = this.currentColor;
                this.ctx.globalAlpha = 0.3;
                this.ctx.lineWidth = this.brushSize * 3;
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
                break;

            case 'eraser':
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.brushSize * 2;
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                this.ctx.globalCompositeOperation = 'source-over';
                break;

            case 'arrow':
            case 'rectangle':
            case 'circle':
                // Redraw canvas without current shape, then draw shape
                this.redraw();
                this.drawShape(this.startX, this.startY, x, y);
                break;
        }

        this.currentAnnotation.points.push({ x, y });
        this.lastX = x;
        this.lastY = y;
    }

    drawShape(x1, y1, x2, y2) {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.brushSize;
        this.ctx.globalAlpha = 1;

        switch (this.currentTool) {
            case 'rectangle':
                this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                break;

            case 'circle':
                const radiusX = Math.abs(x2 - x1) / 2;
                const radiusY = Math.abs(y2 - y1) / 2;
                const centerX = Math.min(x1, x2) + radiusX;
                const centerY = Math.min(y1, y2) + radiusY;

                this.ctx.beginPath();
                this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;

            case 'arrow':
                const headLen = 15;
                const angle = Math.atan2(y2 - y1, x2 - x1);

                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                this.ctx.moveTo(x2, y2);
                this.ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                this.ctx.stroke();
                break;
        }
    }

    stopDrawing() {
        if (this.isDrawing && this.currentAnnotation) {
            // Store shape end points
            if (['arrow', 'rectangle', 'circle'].includes(this.currentTool)) {
                const lastPoint = this.currentAnnotation.points[this.currentAnnotation.points.length - 1];
                this.currentAnnotation.endX = lastPoint.x;
                this.currentAnnotation.endY = lastPoint.y;
            }
            this.annotations.push(this.currentAnnotation);
        }
        this.isDrawing = false;
        this.currentAnnotation = null;
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.annotations.forEach(annotation => {
            this.ctx.strokeStyle = annotation.color;
            this.ctx.lineWidth = annotation.size;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            if (annotation.tool === 'highlighter') {
                this.ctx.globalAlpha = 0.3;
                this.ctx.lineWidth = annotation.size * 3;
            } else {
                this.ctx.globalAlpha = 1;
            }

            if (['arrow', 'rectangle', 'circle'].includes(annotation.tool)) {
                const start = annotation.points[0];
                this.drawShapeFromAnnotation(annotation, start.x, start.y, annotation.endX, annotation.endY);
            } else if (annotation.tool !== 'eraser') {
                this.ctx.beginPath();
                annotation.points.forEach((point, i) => {
                    if (i === 0) {
                        this.ctx.moveTo(point.x, point.y);
                    } else {
                        this.ctx.lineTo(point.x, point.y);
                    }
                });
                this.ctx.stroke();
            }

            this.ctx.globalAlpha = 1;
        });
    }

    drawShapeFromAnnotation(annotation, x1, y1, x2, y2) {
        this.ctx.strokeStyle = annotation.color;
        this.ctx.lineWidth = annotation.size;

        switch (annotation.tool) {
            case 'rectangle':
                this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                break;
            case 'circle':
                const radiusX = Math.abs(x2 - x1) / 2;
                const radiusY = Math.abs(y2 - y1) / 2;
                const centerX = Math.min(x1, x2) + radiusX;
                const centerY = Math.min(y1, y2) + radiusY;
                this.ctx.beginPath();
                this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
            case 'arrow':
                const headLen = 15;
                const angle = Math.atan2(y2 - y1, x2 - x1);
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                this.ctx.moveTo(x2, y2);
                this.ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                this.ctx.stroke();
                break;
        }
    }

    undo() {
        this.annotations.pop();
        this.redraw();
    }

    clear() {
        this.annotations = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    show() {
        this.isActive = true;
        this.canvas.classList.add('active');
        this.toolbar.classList.add('active');
        this.resizeCanvas();
    }

    hide() {
        this.isActive = false;
        this.canvas.classList.remove('active');
        this.toolbar.classList.remove('active');
    }

    toggle() {
        if (this.isActive) {
            this.hide();
        } else {
            this.show();
        }
    }

    getCanvasDataURL() {
        return this.canvas.toDataURL('image/png');
    }
}

// Export for use in recorder.js
window.AnnotationTools = AnnotationTools;
