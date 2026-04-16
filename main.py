from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

import os
import uuid
import requests
import ffmpeg

# ✅ FIXED IMPORT (OLD SDK COMPATIBLE)
from deepgram import DeepgramClient

from Agent.agent import chat
from db import SessionLocal
from crud.session import create_session, get_sessions
from crud.message import create_message, get_messages

from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader, TextLoader, Docx2txtLoader
)

from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore
from qdrant_client.models import VectorParams, Distance


# ===========================
# DB Dependency
# ===========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI()

# 🔊 serve audio files
os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")


# ===========================
# CORS
# ===========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================
# Request schema
# ===========================
class ChatRequest(BaseModel):
    message: str
    session_id: str
    file_id: Optional[str] = None


# ===========================
# Qdrant Setup
# ===========================
qdrant_client = QdrantClient(url="http://localhost:6333")

@app.on_event("startup")
def startup():
    try:
        qdrant_client.get_collection("docs")
    except:
        qdrant_client.create_collection(
            collection_name="docs",
            vectors_config=VectorParams(
                size=1536,
                distance=Distance.COSINE,
            ),
        )


# ===========================
# Upload API
# ===========================
@app.post("/upload")
async def upload(file: UploadFile = File(...), session_id: str = Form(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    file_location = f"temp_{file_id}{ext}"

    with open(file_location, "wb") as f:
        f.write(await file.read())

    if ext == ".pdf":
        loader = PyPDFLoader(file_location)
    elif ext == ".txt":
        loader = TextLoader(file_location)
    elif ext == ".docx":
        loader = Docx2txtLoader(file_location)
    else:
        os.remove(file_location)
        return {"error": "Unsupported file"}

    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
    )
    chunks = splitter.split_documents(docs)

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    for chunk in chunks:
        chunk.metadata["file_id"] = file_id
        chunk.metadata["session_id"] = session_id

    vectorstore = QdrantVectorStore(
        client=qdrant_client,
        collection_name="docs",
        embedding=embeddings,
    )

    vectorstore.add_documents(chunks)
    os.remove(file_location)

    return {"file_id": file_id}


# ===========================
# Chat API
# ===========================
@app.post("/chat")
def chat_api(req: ChatRequest, db: Session = Depends(get_db)):
    user_id = "demo_user"

    create_session(db, req.session_id, user_id)
    create_message(db, req.session_id, user_id, "user", req.message)

    response = chat(req.message, req.session_id, req.file_id)

    create_message(db, req.session_id, user_id, "ai", response)

    return {"response": response}


# ===========================
# Sessions API
# ===========================
@app.get("/sessions")
def sessions(db: Session = Depends(get_db)):
    return get_sessions(db, "demo_user")


@app.get("/messages/{session_id}")
def messages(session_id: str, db: Session = Depends(get_db)):
    msgs = get_messages(db, session_id)
    return [{"role": m.role, "content": m.content} for m in msgs]


# ===========================
# 🎤 SPEECH TO TEXT (FIXED)
# ===========================
def speech_to_text(audio_path: str):
    try:
        api_key = os.getenv("DEEPGRAM_API_KEY")

        wav_path = audio_path.replace(".webm", ".wav")

        # Convert webm → wav
        (
            ffmpeg.input(audio_path)
            .output(wav_path, format="wav", acodec="pcm_s16le", ac=1, ar="16000")
            .run(overwrite_output=True, quiet=True)
        )

        with open(wav_path, "rb") as audio:
            res = requests.post(
                "https://api.deepgram.com/v1/listen",
                headers={
                    "Authorization": f"Token {api_key}",
                    "Content-Type": "audio/wav"
                },
                params={
                    "model": "nova-2",
                    "smart_format": "true"
                },
                data=audio
            )

        data = res.json()

        transcript = (
            data.get("results", {})
            .get("channels", [{}])[0]
            .get("alternatives", [{}])[0]
            .get("transcript", "")
        )

        os.remove(wav_path)

        return transcript

    except Exception as e:
        print("❌ STT:", str(e))
        return ""

# ===========================
# 🔊 TEXT TO SPEECH
# ===========================
def text_to_speech(text: str):
    try:
        res = requests.post(
            "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
            headers={
                "Authorization": f"Token {os.getenv('DEEPGRAM_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={"text": text}
        )

        file = f"audio/{uuid.uuid4()}.mp3"
        with open(file, "wb") as f:
            f.write(res.content)

        return f"/{file}"

    except Exception as e:
        print("❌ TTS:", e)
        return None


# ===========================
# 🎤 VOICE API
# ===========================
@app.post("/voice")
async def voice(file: UploadFile = File(...)):
    input_file = f"temp_{uuid.uuid4()}.webm"

    try:
        with open(input_file, "wb") as f:
            f.write(await file.read())

        text = speech_to_text(input_file)

        if not text:
            return {"error": "No speech detected"}

        response = chat(text, "voice_session")

        audio = text_to_speech(response)

        return {
            "user_text": text,
            "response": response,
            "audio_url": audio
        }

    except Exception as e:
        return {"error": str(e)}

    finally:
        if os.path.exists(input_file):
            os.remove(input_file)