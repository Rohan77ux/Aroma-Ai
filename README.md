## 🧠 Aroma AI – System Architecture

```mermaid
flowchart TD

    %% ================= CORE =================
    A[Aroma AI Core]

    %% ================= AUTH =================
    subgraph AUTH_LAYER [🔐 Authentication Layer]
        B[Auth Service]
        C[(MongoDB)]
        B --> C
    end

    %% ================= CHAT =================
    subgraph CHAT_LAYER [💬 Chat Engine]
        D[Normal Chat]
        E[OpenAI API Calling]
        F[(Postgres)]
        G[(Redis Cache)]
        H[(Neo4j Graph DB)]

        D --> E
        E --> F
        E --> G
        E --> H
    end

    %% ================= RAG =================
    subgraph RAG_LAYER [📚 RAG Pipeline]
        I[RAG Integration]
        J[(Qdrant Vector DB)]

        I --> J
    end

    %% ================= VOICE =================
    subgraph VOICE_LAYER [🎤 Voice AI]
        K[Voice Integration]
        L[Deepgram API]

        K --> L
    end

    %% ================= IMAGE =================
    subgraph IMAGE_LAYER [🖼️ Image Generation]
        M[Image Generation]
        N[CNN + Image Generator]

        M --> N
    end

    %% ================= TOOLS =================
    subgraph TOOL_LAYER [🛠️ External Tools]
        O[API Integration]
        P[3rd Party Tools]

        O --> P
    end

    %% ================= CONNECTIONS =================
    A --> B
    A --> D
    A --> I
    A --> K
    A --> M
    A --> O

    %% ================= STYLING =================
    classDef core fill:#ff9800,stroke:#333,color:#fff
    classDef db fill:#4caf50,stroke:#333,color:#fff
    classDef api fill:#2196f3,stroke:#333,color:#fff
    classDef service fill:#9c27b0,stroke:#333,color:#fff

    class A core
    class C,F,G,H,J db
    class E,L,P api
    class B,D,I,K,M,O,N service
