if (process.env.VERCEL_ENV === "production") {
  await import("./check-production-seed-accounts.mjs");
} else {
  console.log("Production seed-account check skipped outside Vercel production.");
}
