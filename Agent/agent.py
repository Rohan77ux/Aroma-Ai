from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

from redis_client import get_chat_history, save_chat_history

qdrant_client = QdrantClient(url="http://localhost:6333")

llm = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0.7,
    timeout=60,
    max_retries=2,
)

systemPrompt = """
You are an expert AI assistant named Aroma.

Follow these rules strictly:

1. Structure & Clarity
- Use headings and bullet points
- Keep answers well-structured and easy to scan

2. Explanation Style
- Start simple → then go deeper
- Use examples for clarity

3. Tone
- Professional but conversational

4. Depth Control
- Simple → short
- Technical → detailed

5. Code
- Clean with short comments

6. Key Insights
- Add tips when useful

7. Avoid
- Long messy paragraphs

8. If unsure
- Say "I don't know"
"""

# ===========================
#  RETRIEVER (UNCHANGED)
# ===========================
def retrieve_context(query, session_id=None, file_id=None):
    vectorstore = QdrantVectorStore(
        client=qdrant_client,
        collection_name="docs",
        embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    )

    if file_id:
        filter_condition = {
            "must": [
                {"key": "metadata.file_id", "match": {"value": file_id}}
            ]
        }
    else:
        filter_condition = {
            "must": [
                {"key": "metadata.session_id", "match": {"value": session_id}}
            ]
        }

    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 5,
            "fetch_k": 10,
            "lambda_mult": 0.5,
            "filter": filter_condition,
        },
    )

    docs = retriever.invoke(query)
    context = "\n\n".join([doc.page_content for doc in docs])

    return context


# ===========================
#  CHAT FUNCTION (FIXED)
# ===========================
def chat(user_msg, session_id, file_id=None):
    try:
        # ✅ fresh message list every request
        messages = [SystemMessage(content=systemPrompt)]

        # ✅ load Redis history
        history = get_chat_history(session_id)

        # ✅ reconstruct history safely
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))

        # ================= RAG =================
        context = ""
        if file_id or session_id:
            context = retrieve_context(
                query=user_msg,
                session_id=session_id,
                file_id=file_id,
            )

        # ✅ Keep ORIGINAL user message safe
        final_user_msg = user_msg

        if context:
            final_user_msg = f"""
Answer using the context below.

If user asks for summary or explanation, respond accordingly.

Context:
{context}

Question:
{user_msg}
"""

        # ✅ add user msg to LLM
        messages.append(HumanMessage(content=final_user_msg))

        # ✅ LLM call
        response = llm.invoke(messages)
        reply = response.content

        # ================= MEMORY SAVE =================
        history.append({"role": "user", "content": user_msg})  # ✅ original msg
        history.append({"role": "ai", "content": reply})

        # ✅ limit memory
        history = history[-10:]

        save_chat_history(session_id, history)

        return reply

    except Exception as e:
        print("LLM ERROR:", e)
        return "⚠️ AI service unavailable"