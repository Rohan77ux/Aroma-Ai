# 🌸 Aroma AI

A ChatGPT-like AI assistant built with Python (Flask) and vanilla JavaScript.

## Features

- 💬 **Text chat** – multi-turn conversation powered by OpenAI GPT-4o mini
- 🎤 **Voice input** – speak your question using the browser's built-in Speech Recognition API (Chrome / Edge)
- 📄 **PDF Q&A** – upload a PDF and ask questions about its contents

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python · Flask · OpenAI SDK |
| PDF parsing | pypdf |
| Frontend | HTML · CSS · Vanilla JavaScript |
| Markdown | marked.js (CDN) |

## Quick Start

### 1. Clone & install dependencies

```bash
git clone https://github.com/Rohan77ux/Aroma-Ai.git
cd Aroma-Ai
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set your OpenAI API key

```bash
cp .env.example .env
# Edit .env and replace "your_openai_api_key_here" with your real key
```

### 3. Run the app

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

## Usage

| Action | How to |
|--------|--------|
| Send a message | Type in the input box and press **Enter** (or click ➤) |
| Voice input | Click the 🎤 microphone button, speak, then click again to stop |
| PDF Q&A | Click the 📄 paper-clip button, select a PDF, then type your question |
| New conversation | Click **New chat** in the sidebar |

## Project Structure

```
Aroma-Ai/
├── app.py              # Flask backend & API routes
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
├── templates/
│   └── index.html      # Single-page UI
└── static/
    ├── css/style.css   # Dark-theme styles
    └── js/main.js      # Frontend logic
```

