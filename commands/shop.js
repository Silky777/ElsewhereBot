import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getCharByUserSlot, listShopItems, getShopItemByName, purchaseItem } from "../db.js";
import { credits, fmt } from "../utils/format.js";
import { fuzzySuggest } from "../utils/fuzzy.js";

export default {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Shop commands")
    .addSubcommand(sc => sc.setName("list").setDescription("List available shop items"))
    .addSubcommand(sc =>
      sc.setName("buy").setDescription("Buy an item for a character slot")
        .addIntegerOption(o =>
          o.setName("slot").setDescription("Slot 1–3").setRequired(true)
            .addChoices({ name: "Slot 1", value: 1 }, { name: "Slot 2", value: 2 }, { name: "Slot 3", value: 3 })
        )
        .addStringOption(o =>
          o.setName("item").setDescription("Item name (case-insensitive)").setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption(o => o.setName("qty").setDescription("Quantity").setMinValue(1).setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const items = listShopItems();
      const desc = items.length
        ? items.map(i =>
            `• ${i.name} — ${credits(i.price)}${i.one_time ? " — (one-time)" : ""}${i.description ? ` — ${i.description}` : ""}`
          ).join("\n")
        : "*No items available*";
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle("Shop").setDescription(desc)] });
    }

    if (sub === "buy") {
      const slot = interaction.options.getInteger("slot", true);
      const nameInput = interaction.options.getString("item", true);
      let qty = interaction.options.getInteger("qty") ?? 1;

      if (![1, 2, 3].includes(slot)) return interaction.reply({ content: "❌ Slot must be 1–3." });
      if (qty <= 0) return interaction.reply({ content: "❌ Quantity must be at least 1." });

      const item = getShopItemByName(nameInput);
      if (!item) {
        const suggestions = fuzzySuggest(nameInput, listShopItems(), i => i.name, 5).map(i => i.name).join(", ");
        return interaction.reply({
          content: `❌ Item not found.${suggestions ? ` Did you mean: ${suggestions}` : ""}`.trim(),
        });
      }

      // Enforce one-time items
      if (item.one_time) qty = 1;

      const char = getCharByUserSlot(interaction.user.id, slot);
      if (!char) return interaction.reply({ content: `❌ No character in slot **${slot}**.` });

      const total = item.price * qty;
      const res = purchaseItem(char.id, item.name, qty, total, !!item.one_time);
      if (!res.ok) {
        if (res.reason === "already_owned") {
          return interaction.reply({ content: `❌ ${item.name} can only be purchased once for this character.` });
        }
        if (res.reason === "insufficient_funds") {
          return interaction.reply({ content: `❌ Not enough credits. Need ${credits(total)} • Current: ${credits(char.money)}.` });
        }
        return interaction.reply({ content: "❌ Purchase failed." });
      }

      const updated = getCharByUserSlot(interaction.user.id, slot);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Purchase Successful")
            .setDescription(`Bought **${fmt(qty)}× ${item.name}** for ${credits(total)}\nNew balance: ${credits(updated.money)}`),
        ],
      });
    }
  },
};