import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { top25Characters } from "../db.js";
import { credits } from "../utils/format.js";

export default {
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("Top characters"),

  async execute(interaction) {
    const rows = top25Characters();
    const desc = rows.length
      ? rows.map((r, i) => `**${i + 1}.** ${r.name} — ${credits(r.money)} (<@${r.user_id}>)`).join("\n")
      : "No characters yet.";

    return interaction.reply({ embeds: [new EmbedBuilder().setTitle("Leaderboard — Top 25").setDescription(desc)] });
  },
};