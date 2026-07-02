import { z } from "zod";
import { runAndPersistBacktest } from "@/lib/backtest/persist";
import { getPairById } from "@/lib/db/queries/pairs";
import { getStrategyById } from "@/lib/db/queries/strategies";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pairId: z.uuid(),
  strategyId: z.uuid(),
});

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** On-demand single-pair backtest, persisted identically to the monthly cron. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `invalid body: ${message}` }, { status: 400 });
  }

  try {
    const [pair, strategy] = await Promise.all([
      getPairById(body.pairId),
      getStrategyById(body.strategyId),
    ]);
    if (!pair) {
      return Response.json({ error: "pair not found" }, { status: 404 });
    }
    if (!strategy) {
      return Response.json({ error: "strategy not found" }, { status: 404 });
    }

    const summary = await runAndPersistBacktest(pair, strategy);
    if (!summary) {
      return Response.json(
        { error: `no candle history for ${pair.symbol} - run the backfill first` },
        { status: 422 }
      );
    }
    return Response.json({ ok: true, run: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
