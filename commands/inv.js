import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { listInventory } from "../db.js";
import { characterSelectRow, displayNameOf } from "../utils/format.js";
import { getCharsByUser } from "../db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("inv")
    .setDescription("Show inventory for a character")
    .addUserOption((o) =>
      o.setName("user").setDescription("Whose inventory to view (optional)")
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const chars = getCharsByUser(target.id);
    const pretty = displayNameOf(interaction, target);

    if (chars.length === 0) {
      return interaction.reply({
        content: `❌ ${
          target.id === interaction.user.id
            ? "You have"
            : `${pretty} has`
        } no characters.`,
      });
    }

    if (chars.length === 1) {
      const c = chars[0];
      const items = listInventory(Number(c.id));
      const lines = items.length
        ? items.map((i) => `- ${i.qty}x ${i.item}`).join("\n")
        : "*Empty*";
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${c.name} — Inventory`)
            .setDescription(lines),
        ],
      });
    }

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Choose a character for Inventory")],
      components: [characterSelectRow(chars)],
    });
  },
};