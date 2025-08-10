import { SlashCommandBuilder } from "discord.js";
import { getCharByUserSlot, removeItem } from "../db.js";
import { fmt, displayNameOf } from "../utils/format.js";
import { hasModPerms } from "../utils/constants.js";

export default {
  data: new SlashCommandBuilder()
    .setName("removeitem")
    .setDescription("Mod: remove an item from a user's character inventory")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addIntegerOption(o =>
      o.setName("slot").setDescription("Slot 1-3").setRequired(true)
        .addChoices({ name: "Slot 1", value: 1 }, { name: "Slot 2", value: 2 }, { name: "Slot 3", value: 3 })
    )
    .addStringOption(o => o.setName("item").setDescription("Item name").setRequired(true))
    .addIntegerOption(o => o.setName("qty").setDescription("Quantity (>=1)").setMinValue(1).setRequired(true)),

  async execute(interaction) {
    if (!hasModPerms(interaction)) return interaction.reply({ content: "❌ You don't have permission to use this." });

    const target = interaction.options.getUser("user", true);
    const slot = interaction.options.getInteger("slot", true);
    const item = interaction.options.getString("item", true);
    const qty = interaction.options.getInteger("qty", true);

    if (![1, 2, 3].includes(slot) || qty <= 0) {
      return interaction.reply({ content: "❌ Slot must be 1-3 and qty must be ≥ 1." });
    }

    const char = getCharByUserSlot(target.id, slot);
    if (!char) return interaction.reply({ content: `❌ No character for **${displayNameOf(target)}** in slot **${slot}**.` });

    const res = removeItem(char.id, item, qty);
    if (!res.ok) {
      if (res.reason === "not_owned") {
        return interaction.reply({ content: `❌ ${char.name} doesn’t have any **${item}**.` });
      }
      if (res.reason === "not_enough") {
        return interaction.reply({ content: `❌ Not enough **${item}**. Current: ${fmt(res.qty)}.` });
      }
      return interaction.reply({ content: "❌ Failed to remove item." });
    }

    const note = res.qty === 0 ? "Removed completely." : `Now has: **${fmt(res.qty)}× ${item}**`;
    return interaction.reply(
      `✅ Removed **${fmt(qty)}× ${item}** from **${displayNameOf(interaction, target)}** (${char.name}). ${note}`
    );
  },
};