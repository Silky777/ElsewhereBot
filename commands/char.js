import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from "discord.js";
import { getCharsByUser, deleteCharByName, renameChar, savePending } from "../db.js";
import { credits, displayNameOf } from "../utils/format.js";

function slotButtons(existingBySlot) {
  return new ActionRowBuilder().addComponents(
    ...[1, 2, 3].map((s) => {
      const taken = !!existingBySlot[s];
      return new ButtonBuilder()
        .setCustomId(`char_create_${s}`)
        .setStyle(taken ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(taken)
        .setLabel(taken ? `Slot ${s} — ${existingBySlot[s].name}` : `Slot ${s}`);
    })
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName("char")
    .setDescription("Manage your characters")
    .addSubcommand(sc =>
      sc.setName("create").setDescription("Create a character (choose slot after)")
        .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("delete").setDescription("Delete a character by name")
        .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("rename").setDescription("Rename a character in a slot")
        .addIntegerOption(o =>
          o.setName("slot").setDescription("Slot 1-3").setRequired(true)
            .addChoices({ name: "Slot 1", value: 1 }, { name: "Slot 2", value: 2 }, { name: "Slot 3", value: 3 })
        )
        .addStringOption(o => o.setName("name").setDescription("New name").setRequired(true))
    )
    .addSubcommand(sc => sc.setName("list").setDescription("List your characters")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === "create") {
      const name = interaction.options.getString("name", true);
      const existing = getCharsByUser(userId);
      const bySlot = Object.fromEntries(existing.map((c) => [c.slot, c]));

      const row = slotButtons(bySlot);
      const msg = await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Create Character").setDescription(`Choose a slot for **${name}**.`)],
        components: [row],
        fetchReply: true,
      });

      savePending(msg.id, userId, name);
      return;
    }

    if (sub === "delete") {
      const name = interaction.options.getString("name", true);
      const { deleted, slot } = deleteCharByName(userId, name);
      if (!deleted) return interaction.reply({ content: `❌ No character named **${name}** found.` });
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Character Deleted").setDescription(`Removed **${name}** from slot **${slot}**.`)],
      });
    }

    if (sub === "rename") {
      const slot = interaction.options.getInteger("slot", true);
      const newName = interaction.options.getString("name", true);
      const res = renameChar(userId, slot, newName);
      if (!res.ok) return interaction.reply({ content: `❌ No character in slot **${slot}** to rename.` });
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Character Renamed").setDescription(`Slot **${slot}** is now **${newName}**.`)],
      });
    }

    if (sub === "list") {
      const rows = getCharsByUser(userId);
      const desc = rows.length ? rows.map((r) => `**Slot ${r.slot}** — ${r.name} • ${credits(r.money)}`).join("\n") : "*You have no characters yet. Use `/char create`.*";
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${displayNameOf(interaction, interaction.user)}'s Characters`).setDescription(desc)] });
    }
  },
};