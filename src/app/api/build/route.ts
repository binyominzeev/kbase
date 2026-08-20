import { buildFormSchema, toBuildErrorMessage } from "@/lib/knowledge-base/build-input";
import { buildKnowledgeBase } from "@/lib/knowledge-base/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const body = (await request.json()) as { sourceUrl?: unknown };
        const parsed = buildFormSchema.safeParse({ sourceUrl: body.sourceUrl });

        if (!parsed.success) {
          send("error", {
            message: parsed.error.issues[0]?.message ?? "Invalid share URL.",
          });
          return;
        }

        const knowledgeBase = await buildKnowledgeBase(parsed.data.sourceUrl, (progress) => {
          send("progress", progress);
        });
        send("complete", { slug: knowledgeBase.slug });
      } catch (error) {
        send("error", { message: toBuildErrorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}