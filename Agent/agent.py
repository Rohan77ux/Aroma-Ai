from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

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


def chat(msg):
    message.append(HumanMessage(content=msg))

    try:
        response = llm.invoke(message)  
        reply = response.content        

        message.append(response)        

        return reply

    except Exception as e:
        print("LLM ERROR:", e)
        return "⚠️ AI service unavailable"