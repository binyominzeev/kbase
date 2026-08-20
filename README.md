# KBase

KBase turns a public AI conversation into a small, navigable encyclopedia.

## Stack

- Next.js + TypeScript
- PostgreSQL + Prisma
- Tailwind CSS
- OpenAI behind a small extractor abstraction (`LLM_PROVIDER`)

## How it works

```text
Public conversation URL
        ↓
Conversation importer
        ↓
Normalized conversation
        ↓
LLM knowledge extraction
        ↓
Structured knowledge base
        ↓
Web renderer
```

The MVP currently supports public ChatGPT share links.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Set a PostgreSQL `DATABASE_URL`.

4. Generate the Prisma client and apply your schema:

   ```bash
   npm run prisma:generate
   npx prisma migrate dev --name init
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`, paste a public ChatGPT share URL, and click **Build Knowledge Base**.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for persisted knowledge bases |
| `OPENAI_API_KEY` | Yes for live extraction | OpenAI API key |
| `OPENAI_MODEL` | No | Defaults to `gpt-4.1-mini` |
| `LLM_PROVIDER` | No | `openai` or `mock` |

`LLM_PROVIDER=mock` is useful for local smoke testing the UI without calling OpenAI. In mock mode you can use `https://chatgpt.com/share/mock-progtaxi` for a deterministic end-to-end demo.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run prisma:generate`
