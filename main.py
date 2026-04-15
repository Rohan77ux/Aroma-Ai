
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from Agent.agent import chat
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

import os
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    Docx2txtLoader
)
import uuid
from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Request body schema
class ChatRequest(BaseModel):
    message: str
    file_id: Optional[str] = None

qdrant_client = QdrantClient(url="http://localhost:6333")
from qdrant_client.models import VectorParams, Distance

@app.on_event("startup")
def startup():
    qdrant_client.recreate_collection(
        collection_name="docs",
        vectors_config=VectorParams(
            size=1536,  # OpenAI embedding size
            distance=Distance.COSINE,
        ),
    )

# Root route (optional)
@app.get("/")
def home():
    return {"message": "AI Chat Backend Running 🚀"}



#uploading documents
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    #  Create unique file name
    file_id = str(uuid.uuid4())
    file_location = f"temp_{file_id}{ext}"

    #  Save file to disk
    with open(file_location, "wb") as f:
        f.write(await file.read())


    if ext == ".pdf":
        loader = PyPDFLoader(file_location)

    elif ext == ".txt":
        loader = TextLoader(file_location, encoding="utf-8")

    elif ext == ".docx":
        loader = Docx2txtLoader(file_location)

    else:
        os.remove(file_location)
        raise ValueError("Unsupported file type")


    docs =  loader.load() 
    
    splitter = RecursiveCharacterTextSplitter(
    chunk_size = 1000,
    chunk_overlap = 10,
    )
    
    chunks = splitter.split_documents(docs)
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
    # Add metadata
    for chunk in chunks:
        chunk.metadata["file_id"] = file_id

    # Store in SINGLE collection (best practice)
    collection_name = "docs"

    
    vectorstore = QdrantVectorStore(
    client=qdrant_client,
    collection_name=collection_name,
    embedding=embeddings_model,
)

# Add documents
    vectorstore.add_documents(chunks)
    
    os.remove(file_location)
    
    return {
        "message": "File uploaded successfully",
        "file_id": file_id
    }

# Chat API
@app.post("/chat")
def chat_api(req: ChatRequest):
    response = chat(req.message, req.file_id)
    return {"response": response}