import "server-only";

/**
 * Records slow server-side reads without request parameters, IDs or returned data.
 * Useful for comparing desktop and PWA navigation latency in Vercel logs.
 */
export async function timedServerRead<T>(
  route: "pharmacies" | "orders" | "pharmacy_detail",
  operation: string,
  query: PromiseLike<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await query;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= 250) {
      console.info(JSON.stringify({
        event: "tr1_server_read_latency",
        route,
        operation,
        durationMs,
      }));
    }
  }
}
