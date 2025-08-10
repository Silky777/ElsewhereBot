import { SlashCommandBuilder } from "discord.js";
import { getCharByUserSlot, giveItem } from "../db.js";
import { fmt, displayNameOf } from "../utils/format.js";
import { hasModPerms } from "../utils/constants.js";

export default {
  data: new SlashCommandBuilder()
    .setName("additem")
    .setDescription("Mod: add an item to a user's character inventory")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addIntegerOption(o =>
      o.setName("slot").setDescription("Slot 1–3").setRequired(true)
        .addChoices({ name: "Slot 1", value: 1 }, { name: "Slot 2", value: 2 }, { name: "Slot 3", value: 3 })
    )
    .addStringOption(o => o.setName("item").setDescription("Item name").setRequired(true))
    .addIntegerOption(o => o.setName("qty").setDescription("Quantity (>=1)").setMinValue(1).setRequired(false))
    .addBooleanOption(o => o.setName("one_time").setDescription("Mark as one-time (no quantity)").setRequired(false)),

  async execute(interaction) {
    if (!hasModPerms(interaction)) return interaction.reply({ content: "❌ You don't have permission to use this." });

    const target = interaction.options.getUser("user", true);
    const slot = interaction.options.getInteger("slot", true);
    const item = interaction.options.getString("item", true).trim();
    const oneTime = interaction.options.getBoolean("one_time") ?? false;
    const qty = oneTime ? 1 : (interaction.options.getInteger("qty") ?? 1);

    if (![1, 2, 3].includes(slot) || qty <= 0) {
      return interaction.reply({ content: "❌ Slot must be 1-3 and qty must be ≥ 1." });
    }

    const char = getCharByUserSlot(target.id, slot);
    if (!char) return interaction.reply({ content: `❌ No character for **${displayNameOf(target)}** in slot **${slot}**.` });

    const res = giveItem(char.id, item, qty, oneTime);
    const actual = res.item ?? item;

    const itemLabel = res.one_time ? `**${actual}**` : `**${fmt(qty)}x ${actual}**`;
    const nowHas = res.one_time ? `**${actual}**` : `**${fmt(res.qty)}x ${actual}**`;

    return interaction.reply(
      `✅ Added ${itemLabel} to **${displayNameOf(interaction, target)}** (${char.name}). Now has: ${nowHas}`
    );
  },
};