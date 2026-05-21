import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const url = `${API_BASE}/api/goatmez/${segments.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (process.env.ANTHROPIC_API_KEY) {
    headers.Authorization = `Bearer ${process.env.ANTHROPIC_API_KEY}`;
  }

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const payload = hasBody ? await req.text() : undefined;

  const response = await fetch(url, {
    method,
    headers,
    body: payload && payload.trim() ? payload : undefined
  });
  const text = await response.text();

  return new NextResponse(text || "{}", {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json"
    }
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path || []);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path || []);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path || []);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path || []);
}
