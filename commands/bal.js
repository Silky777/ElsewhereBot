import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getCharsByUser } from "../db.js";
import { characterSelectRow, credits } from "../utils/format.js";

export default {
  data: new SlashCommandBuilder()
    .setName("bal")
    .setDescription("Show balance for a character (skips picker if only one)")
    .addUserOption(o => o.setName("user").setDescription("Whose balance to view (optional)")),

  async execute(interaction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const chars = getCharsByUser(target.id);

    // No characters
    if (chars.length === 0) {
      return interaction.reply({ content: "No characters yet. Use `/char create` first." });
    }

    // Exactly one character: reply directly
    if (chars.length === 1) {
      const c = chars[0];
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${c.name} — Balance`)
            .setDescription("## " + credits(c.money)),
        ],
      });
    }

    // Multiple characters: show picker
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Choose a character for Balance")],
      components: [characterSelectRow(chars)],
    });
  },
};