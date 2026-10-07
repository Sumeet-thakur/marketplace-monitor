// Next.js calls this exactly once when the server process starts (both in
// `next dev` and `next start`). We use it to boot the in-process polling
// scheduler so background sync begins as soon as the app is running,
// without any manual "start worker" step for the demo.
//
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/sync/scheduler");
    startScheduler();
  }
}
