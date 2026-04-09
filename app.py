import os
import json
import uuid
from pathlib import Path

from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from openai import OpenAI
from pypdf import PdfReader
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))
CORS(app)

UPLOAD_FOLDER = Path("uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {"pdf"}
MAX_PDF_CHARS = 40000  # limit context sent to the model

# Maximum number of recent messages to include in the chat context.
# PDF Q&A uses a shorter window (PDF_CHAT_HISTORY_LIMIT) because the PDF
# content already consumes a large portion of the context window.
CHAT_HISTORY_LIMIT = 40
PDF_CHAT_HISTORY_LIMIT = 10

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# In-memory conversation store keyed by session id
conversations: dict[str, list[dict]] = {}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_or_create_conversation(session_id: str) -> list[dict]:
    if session_id not in conversations:
        conversations[session_id] = []
    return conversations[session_id]


def extract_pdf_text(filepath: Path) -> str:
    reader = PdfReader(filepath)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)


@app.route("/")
def index():
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    session_id = data.get("session_id") or session.get("session_id", str(uuid.uuid4()))

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    history = get_or_create_conversation(session_id)

    history.append({"role": "user", "content": user_message})

    system_prompt = (
        "You are Aroma AI, a helpful, creative, and knowledgeable assistant. "
        "Answer questions clearly and thoroughly. Use markdown formatting where appropriate."
    )

    messages = [{"role": "system", "content": system_prompt}] + history[-CHAT_HISTORY_LIMIT:]

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        assistant_message = response.choices[0].message.content
        history.append({"role": "assistant", "content": assistant_message})
        return jsonify({"reply": assistant_message, "session_id": session_id})
    except Exception:
        # Remove the user message we just appended so history stays consistent
        history.pop()
        return jsonify({"error": "Failed to get a response from the AI service. Please try again."}), 500


@app.route("/api/upload-pdf", methods=["POST"])
def upload_pdf():
    session_id = request.form.get("session_id") or session.get("session_id", str(uuid.uuid4()))
    question = (request.form.get("question") or "").strip()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Invalid or unsupported file. Please upload a PDF."}), 400

    filename = secure_filename(file.filename)
    filepath = UPLOAD_FOLDER / filename
    file.save(filepath)

    try:
        pdf_text = extract_pdf_text(filepath)
    except Exception:
        return jsonify({"error": "Could not read the PDF. Ensure it is a valid, readable PDF file."}), 500
    finally:
        try:
            filepath.unlink()
        except OSError:
            pass

    if not pdf_text.strip():
        return jsonify({"error": "PDF appears to be empty or contains no extractable text."}), 400

    truncated_text = pdf_text[:MAX_PDF_CHARS]
    if len(pdf_text) > MAX_PDF_CHARS:
        truncated_text += "\n\n[Note: PDF was truncated to fit context limits.]"

    if question:
        prompt = (
            f"The following is the content of an uploaded PDF document:\n\n"
            f"{truncated_text}\n\n"
            f"Based on this document, please answer the following question:\n{question}"
        )
    else:
        prompt = (
            f"The following is the content of an uploaded PDF document:\n\n"
            f"{truncated_text}\n\n"
            f"Please provide a concise summary of this document."
        )

    history = get_or_create_conversation(session_id)
    history.append({"role": "user", "content": prompt})

    system_prompt = (
        "You are Aroma AI, a helpful assistant. "
        "When given PDF content, extract and explain information clearly. "
        "Use markdown formatting where appropriate."
    )

    messages = [{"role": "system", "content": system_prompt}] + history[-PDF_CHAT_HISTORY_LIMIT:]

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.5,
            max_tokens=2048,
        )
        assistant_message = response.choices[0].message.content
        history.append({"role": "assistant", "content": assistant_message})
        return jsonify({"reply": assistant_message, "session_id": session_id})
    except Exception:
        history.pop()
        return jsonify({"error": "Failed to get a response from the AI service. Please try again."}), 500


@app.route("/api/clear", methods=["POST"])
def clear_conversation():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id") or session.get("session_id")
    if session_id and session_id in conversations:
        conversations[session_id] = []
    return jsonify({"status": "cleared"})


if __name__ == "__main__":
    app.run(debug=False, port=5000)
