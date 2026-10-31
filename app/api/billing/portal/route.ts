import { billingErrorResponse, createPortal } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    return Response.json(await createPortal(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
