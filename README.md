# 🎬 Screen Recorder Pro

A modern, unlimited screen recording web application built with Python Flask.

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.0+-000000?logo=flask&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

## ✨ Features

- 🎥 **Unlimited Recording** - No time limits on recordings
- 🔒 **Password Protection** - Encrypt recordings with Fernet encryption
- ✏️ **Annotation Tools** - Draw, highlight, shapes while recording
- 🖥️ **Multi-monitor Support** - Select Screen, Window, or Tab
- 🎨 **Modern UI** - Futuristic gradient design with glassmorphism
- 🎤 **Audio Support** - System audio and microphone capture
- ⏸️ **Pause/Resume** - Control your recording flow
- 💾 **SQLite Storage** - Metadata stored in local database

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Modern web browser (Chrome, Firefox, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bawan2001/Screen-Recoder-.git
   cd Screen-Recoder-
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Open in browser**
   ```
   http://localhost:5000
   ```

## 🐳 Run with Docker

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bawan2001/Screen-Recoder-.git
   cd Screen-Recoder-
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudinary credentials (optional)
   ```

3. **Build and run**
   ```bash
   docker-compose up --build
   ```

4. **Open in browser**
   ```
   http://localhost:8080
   ```

5. **Stop the container**
   ```bash
   docker-compose down
   ```

### Using Dockerfile Directly

```bash
docker build -t screen-recorder-pro .
docker run -p 8080:5000 --env-file .env screen-recorder-pro
```

4. **Open in browser**
   ```
   http://localhost:8080
   ```

## 📁 Project Structure

```
screen-recorder/
├── app.py              # Flask backend with SQLite
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html      # Main UI
├── static/
│   ├── css/
│   │   └── style.css   # Modern gradient styling
│   ├── js/
│   │   ├── recorder.js # Recording logic
│   │   └── annotate.js # Drawing tools
│   └── images/
│       └── bg.png      # Background image
└── recordings/         # Saved recordings (auto-created)
    └── metadata.db     # SQLite database
```

## 🎮 Usage

### Recording
1. Click **Start Recording**
2. Select screen/window/tab to capture
3. Use **Pause** to pause, **Stop** to finish
4. **Download** or **Save to Server**

### Password Protection
1. Click **Save with Password**
2. Enter and confirm password
3. Recording is encrypted with Fernet
4. Enter password to download

### Annotations
1. Click **Annotate** during recording
2. Choose tool: Pen, Highlighter, Shapes, Eraser
3. Select color and brush size
4. Draw on screen

## 🛠️ Technologies

| Technology | Purpose |
|------------|---------|
| Flask | Web framework |
| SQLite | Metadata storage |
| Cryptography | Password encryption |
| MediaRecorder API | Screen capture |
| Canvas API | Annotation drawing |

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main page |
| `/upload` | POST | Save recording |
| `/recordings` | GET | List recordings |
| `/decrypt/<file>` | POST | Download encrypted |
| `/delete/<file>` | DELETE | Delete recording |
| `/stats` | GET | Storage statistics |

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Made with Bawan using Python Flask
