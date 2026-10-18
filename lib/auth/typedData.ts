// EIP-712 shapes La Ruta signs over. Browser-safe: imports nothing.
//
// La Ruta has its OWN domain (name "EmpowerToursLaRuta"), so a La Ruta login
// signature can never be replayed as a Hunt session or a Hunt claim, and vice
// versa. The WALLET is the same one Hunt uses — see lib/auth/passkey.ts.

export const RUTA_DOMAIN = {
  name: "EmpowerToursLaRuta",
  version: "1",
  chainId: 143,
} as const;

export const SESSION_TYPES = {
  Session: [
    { name: "wallet", type: "address" },
    { name: "statement", type: "string" },
    { name: "clientTs", type: "uint256" },
    { name: "nonce", type: "string" },
  ],
} as const;

export const SESSION_STATEMENT =
  "Sign in to EmpowerTours La Ruta. This does not authorise a transaction.";
