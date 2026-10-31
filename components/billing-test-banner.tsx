"use client";

import { useEffect, useState } from "react";

export default function BillingTestBanner() {
  const [account, setAccount] = useState<{ billingTestMode?: boolean; userId?: string | null; canGenerate?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : {})
      .then(setAccount)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!account.billingTestMode) return null;
  return (
    <aside className="billing-test-banner" aria-label="Billing test mode">
      <strong>Billing test mode</strong>
      <span>No real payments. Explore the demo and try the CA$1 monthly checkout. Live AI generation is reserved for the owner.</span>
      {!account.userId && <a href="/signin-with-chatgpt?return_to=%2Fstudio" target="_top">Owner sign in</a>}
      {account.canGenerate && <span className="billing-owner-badge">Owner access</span>}
    </aside>
  );
}
