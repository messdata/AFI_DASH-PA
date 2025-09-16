import { NextResponse } from "next/server";

async function fetchWithRetry(url: string, tries = 3, delayMs = 800): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return res;
      lastErr = new Error(`status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i))); // backoff
  }
  throw lastErr;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const url = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${id}/JSON-stat/2.0/en`;
  try {
    const res = await fetchWithRetry(url, 3);
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: `PxStat unreachable: ${e?.message || e}` },
      { status: 503 }
    );
  }
}
