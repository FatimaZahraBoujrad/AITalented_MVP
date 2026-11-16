/** Public origin used in emails and redirect links. Supplied by compose in the sandbox. */
export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
