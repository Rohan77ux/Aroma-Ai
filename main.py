from fastapi import FastAPI
from pydantic import BaseModel
from Agent.agent import chat
from fastapi.middleware.cors import CORSMiddleware

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

# Root route (optional)
@app.get("/")
def home():
    return {"message": "AI Chat Backend Running 🚀"}

# Chat API
@app.post("/chat")
def chat_api(req: ChatRequest):
    response = chat(req.message)
    return {"response": response}