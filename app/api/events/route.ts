import { requireUser } from "@/lib/apiAuth";
import { subscribe, type DashboardEvent } from "@/lib/eventBus";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => void 0;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: DashboardEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      // Initial comment to open the stream promptly for some proxies/clients.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      unsubscribe = subscribe(send);

      // Heartbeat so intermediary proxies/load balancers don't kill an idle
      // connection, and so the client can detect a dead connection.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // @ts-expect-error stash for cleanup
      controller.__heartbeat = heartbeat;
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
