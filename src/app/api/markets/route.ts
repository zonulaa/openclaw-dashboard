import { NextResponse } from "next/server";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";

async function fetchFinnhub(symbol: string, label: string, currency = "USD") {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json() as { c?: number; d?: number; dp?: number; pc?: number };
    const price = data?.c ?? 0;
    const change24h = data?.dp ?? 0;
    if (!price) throw new Error("no data");
    return { symbol: label, price, change24h, currency };
  } catch {
    return { symbol: label, price: 0, change24h: 0, currency };
  }
}

async function fetchYahoo(symbol: string, label: string, currency = "USD") {
  try {
    const encoded = encodeURIComponent(symbol);
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } }
    );
    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
        }>;
      };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? 0;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
    const change24h = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return { symbol: label, price, change24h, currency };
  } catch {
    return { symbol: label, price: 0, change24h: 0, currency };
  }
}

export async function GET() {
  const [aapl, tsla, btc, gold, silver] = await Promise.all([
    // US Stocks — Finnhub
    fetchFinnhub("AAPL", "AAPL"),
    fetchFinnhub("TSLA", "TSLA"),
    // Crypto — Finnhub
    fetchFinnhub("BINANCE:BTCUSDT", "BTC"),
    // Commodities — Yahoo Finance (not on Finnhub free tier)
    fetchYahoo("GC=F", "Gold"),
    fetchYahoo("SI=F", "Silver"),
  ]);

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    markets: [aapl, tsla, btc, gold, silver],
  });
}
