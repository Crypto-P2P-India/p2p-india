// Shared admin allowlist + display identity for dispute chat
export const ADMIN_ALLOWLIST = [
  "0xa88798d834453f59f0797409342a95c79642cbea",
];

export const ADMIN_DISPLAY_NAME = "Tobi";

export function isAdminAddress(addr?: string | null): boolean {
  if (!addr) return false;
  return ADMIN_ALLOWLIST.includes(addr.toLowerCase());
}
