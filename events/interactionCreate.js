import { EmbedBuilder, Events } from "discord.js";
import { db, getCharByUserSlot, listInventory, getPending, clearPending, createChar, listShopItems } from "../db.js";
import { credits } from "../utils/format.js";
import { fuzzySuggest } from "../utils/fuzzy.js";

export default function interactionCreateEvent(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // Autocomplete for /shop buy item
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === "shop") {
          const sub = interaction.options.getSubcommand(false);
          const focused = interaction.options.getFocused(true);
          if (sub === "buy" && focused?.name === "item") {
            const items = listShopItems();
            const picks = fuzzySuggest(focused.value ?? "", items, i => i.name, 25);
            return interaction.respond(
              picks.slice(0, 25).map(i => ({ name: `${i.name} — ${i.price}`, value: i.name }))
            );
          }
        }
        return;
      }

      // Slash commands -> dispatch to per-file commands
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands?.get(interaction.commandName);
        if (!cmd) return;
        await cmd.execute(interaction, client);
        return;
      }

      // Create-slot buttons
      if (interaction.isButton() && interaction.customId.startsWith("char_create_")) {
        const pending = getPending(interaction.message.id);
        if (!pending || pending.user_id !== interaction.user.id) {
          return interaction.reply({ content: "❌ That’s not your menu.", ephemeral: true });
        }
        const slot = Number(interaction.customId.split("_").pop());
        if (![1, 2, 3].includes(slot)) {
          return interaction.reply({ content: "❌ Invalid slot.", ephemeral: true });
        }

        const exists = getCharByUserSlot(interaction.user.id, slot);
        if (exists) {
          clearPending(interaction.message.id);
          return interaction.update({
            content: `Slot ${slot} is already **${exists.name}**.`,
            embeds: [],
            components: [],
          });
        }

        createChar(interaction.user.id, slot, pending.name);
        clearPending(interaction.message.id);

        return interaction.update({
          embeds: [new EmbedBuilder().setTitle("Character Created").setDescription(`Created **${pending.name}** in slot **${slot}**.`)],
          components: [],
        });
      }

      // Select menus: pick_generic (Balance/Inventory)
      if (interaction.isStringSelectMenu() && interaction.customId === "pick_generic") {
        const value = interaction.values[0];
        if (value === "none") {
          return interaction.update({ content: "No characters yet. Use `/char create` first.", embeds: [], components: [] });
        }
        const title = interaction.message.embeds[0]?.title ?? "";

        if (/Balance/i.test(title)) {
          const row = db.prepare(`SELECT name, money FROM characters WHERE id = ? AND user_id = ?`).get(value, interaction.user.id);
          if (!row) return interaction.update({ content: "❌ Character not found.", embeds: [], components: [] });

          return interaction.update({
            embeds: [new EmbedBuilder().setTitle(`${row.name} — Balance`).setDescription("## " + credits(row.money))],
            components: [],
          });
        }

        if (/Inventory/i.test(title)) {
          const items = listInventory(Number(value));
          const lines = items.length
            ? items.map(i => (i.one_time ? `**• ${i.item}**` : `**• ${i.item}x ${i.qty}**`)).join("\n")
            : "*Empty*";
          return interaction.update({
            embeds: [new EmbedBuilder().setTitle("Inventory").setDescription(lines)],
            components: [],
          });
        }

        return interaction.update({ content: "❌ Unknown picker context.", components: [] });
      }
    } catch (err) {
      console.error(err);
      const msg = "Something went wrong. (Check bot logs)";
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: msg, ephemeral: true });
        } else {
          await interaction.reply({ content: msg, ephemeral: true });
        }
      } catch {}

      // Also notify in channel
      try {
        await interaction.channel?.send({
          content: "<@225466897301241856> Fix your bot you idiot.",
          allowedMentions: { users: ["225466897301241856"] },
        });
      } catch {}
    }
  });
}