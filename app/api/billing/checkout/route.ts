import { billingErrorResponse, createCheckout } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    const { url, cookie } = await createCheckout(request);
    return Response.json(
      { url },
      { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}
