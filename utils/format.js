import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";

export const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");
export const credits = (n) => `<:ew_credits:1374386244120739981> **${fmt(n)} Credits**`;
export function characterSelectRow(chars) {
  const options = (chars?.length
    ? chars.map(c => ({ label: `Slot ${c.slot} — ${c.name}`, value: String(c.id) }))
    : [{ label: "No characters yet", value: "none", default: true, description: "Use `/char create` first" }]);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("pick_generic")
      .setPlaceholder("Choose a character")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options)
  );
}
export function displayNameOf(a, b) {
  const guild = a?.guild ?? a?.member?.guild;     // if an Interaction or GuildMember was passed
  const user = (b ?? a?.user ?? a) || null;       // prefer explicit user, else a.user, else a

  const member = guild?.members?.cache?.get?.(user?.id);
  return (
    member?.displayName ??
    user?.globalName ??
    user?.username ??
    user?.tag ??
    String(user?.id ?? "Unknown")
  );
}