from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI , OpenAIEmbeddings

from langchain_core.messages import SystemMessage, HumanMessage,AIMessage
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

qdrant_client = QdrantClient(url="http://localhost:6333")

llm = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0.7,
    timeout=60,
    max_retries=2,
)


message = []


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

message.append(SystemMessage(content=systemPrompt))

def retrieve_context(query, file_id):
    """RAG retrieval from Qdrant"""

    vectorstore = QdrantVectorStore(
        client=qdrant_client,
        collection_name="docs",
        embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    )

    retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 5,
        "fetch_k": 10,
        "lambda_mult": 0.5,
        "filter": {
            "must": [
                {
                    "key": "metadata.file_id",  
                    "match": {"value": file_id}
                }
            ]
        }
    }
)

    docs = retriever.invoke(query)
   

    context = "\n\n".join([doc.page_content for doc in docs])

    return context

def chat(msg,file_id=None):
   

    try:
        
        if file_id:
            context = retrieve_context(msg, file_id)

            prompt = f"""
You are an AI assistant.

Answer the question using the context below.
if user query ia also give the summary or explain all the topic in detail or in short then explain.

If answer is not found, say "Not found in document".

Context:
{context}

Question:
{msg}
"""

            message.append(HumanMessage(content=prompt))
        else:
            message.append(HumanMessage(content=msg))  
             
        response = llm.invoke(message)  
        reply = response.content        

        message.append(AIMessage (content=reply) )        

        return reply

    except Exception as e:
        print("LLM ERROR:", e)
        return "⚠️ AI service unavailable"