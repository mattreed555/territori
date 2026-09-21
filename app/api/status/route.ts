import { env } from 'cloudflare:workers';
export async function GET() {
  return Response.json({ ready: Boolean((env as unknown as Record<string, string>).TYPESAFE_API_KEY) }, { headers: { 'Cache-Control': 'no-store' } });
}
