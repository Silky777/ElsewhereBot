import { PermissionsBitField } from "discord.js";

export const CRED_EMOJI = "<:ew_credits:1374386244120739981>";
export const ALLOWED_ROLE_IDS = new Set([
    "1287233577225814131",
    "1287233378973777973",
    "1282167666898899045",
]);
export function hasModPerms(interaction) {
  const isAdmin =
    interaction.member?.permissions?.has?.(PermissionsBitField.Flags.Administrator) ?? false;
  const hasRole =
    interaction.member?.roles?.cache?.some(r => ALLOWED_ROLE_IDS.has(r.id)) ?? false;
  return isAdmin || hasRole;
}