import { health } from "@/lib/learning/config";
export function GET() {
  return Response.json(health(), { headers: { "Cache-Control": "no-store" } });
}
