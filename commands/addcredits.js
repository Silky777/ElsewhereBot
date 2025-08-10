import { SlashCommandBuilder } from "discord.js";
import { db, getCharByUserSlot } from "../db.js";
import { credits, fmt, displayNameOf } from "../utils/format.js";
import { CRED_EMOJI } from "../utils/constants.js";
import { hasModPerms } from "../utils/constants.js";

export default {
  data: new SlashCommandBuilder()
    .setName("addcredits")
    .setDescription("Add credits to a user's character slot")
    .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
    .addIntegerOption(o =>
      o.setName("slot").setDescription("Slot 1–3").setRequired(true)
        .addChoices({ name: "Slot 1", value: 1 }, { name: "Slot 2", value: 2 }, { name: "Slot 3", value: 3 })
    )
    .addIntegerOption(o => o.setName("amount").setDescription("Amount to add (>=1)").setRequired(true)),

  async execute(interaction) {
    if (!hasModPerms(interaction)) return interaction.reply({ content: "❌ You don’t have permission to use this." });

    const target = interaction.options.getUser("user", true) ?? interaction.user;
    const slot = interaction.options.getInteger("slot", true);
    const amount = interaction.options.getInteger("amount", true);

    if (![1, 2, 3].includes(slot) || amount <= 0) {
      return interaction.reply({ content: "❌ Slot must be 1–3 and amount must be ≥ 1." });
    }

    const char = getCharByUserSlot(target.id, slot);
    if (!char) return interaction.reply({ content: `❌ No character for **${displayNameOf(target)}** in slot **${slot}**.` });

    db.prepare(`UPDATE characters SET money = money + ? WHERE id = ?`).run(amount, char.id);
    const updated = getCharByUserSlot(target.id, slot);

    return interaction.reply(
      `✅ Added **${fmt(amount)}** ${CRED_EMOJI} to **${displayNameOf(interaction, target)}** (${updated.name}). ` +
      `New balance: ${credits(updated.money)}`
    );
  },
};