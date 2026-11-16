/** Trial / subscription gate, kept free of Next.js imports so the worker can use it too. */
export function recruiterHasAccess(account: {
  billingStatus: string;
  trialEndsAt: Date;
}): boolean {
  if (account.billingStatus === "active") return true;
  if (account.billingStatus === "trial") return account.trialEndsAt.getTime() > Date.now();
  return false;
}
