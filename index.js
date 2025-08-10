// index.js
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    StringSelectMenuBuilder,
    PermissionsBitField,
} from "discord.js";
import { config } from "dotenv"; config();
import {
    db,
    init,
    getCharsByUser,
    getCharByUserSlot,
    createChar,
    deleteCharByName,
    renameChar,
    listInventory,
    savePending,
    getPending,
    clearPending,
    top25Characters,
} from "./db.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* =========================
   Constants / helpers
========================= */
const CRED_EMOJI = "<:ew_credits:1374386244120739981>";
const fmt = (n) => Number(n ?? 0).toLocaleString("en-US");
const credits = (n) => `${CRED_EMOJI} **${fmt(n)} Credits**`;

const ALLOWED_ROLE_IDS = new Set([
    "1287233577225814131",
    "1287233378973777973",
    "1282167666898899045",
]);

function hasModPerms(interaction) {
    const isAdmin = interaction.member?.permissions?.has?.(PermissionsBitField.Flags.Administrator) ?? false;
    const hasRole = interaction.member?.roles?.cache?.some((r) => ALLOWED_ROLE_IDS.has(r.id)) ?? false;
    return isAdmin || hasRole;
}

function displayNameOf(interaction, user) {
    const member = interaction.guild?.members?.cache?.get(user.id);
    return member?.displayName ?? user.username ?? user.tag ?? user.id;
}

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

function characterSelectRow(chars, customId, placeholder = "Choose a character") {
    const options = chars.length
        ? chars.map((c) => ({ label: `Slot ${c.slot} — ${c.name}`, value: String(c.id) }))
        : [{ label: "No characters yet", value: "none", default: true, description: "Use /char create first" }];

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options)
    );
}

/* =========================
   Boot
========================= */
client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});
init();

/* =========================
   Interactions
========================= */
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        /* ---------- Slash commands ---------- */
        if (interaction.isChatInputCommand()) {
            const userId = interaction.user.id;

            // Character management command
            if (interaction.commandName === "char") {
                const sub = interaction.options.getSubcommand();

                // character create
                if (sub === "create") {
                    const name = interaction.options.getString("name", true);
                    const existing = getCharsByUser(userId);
                    const bySlot = Object.fromEntries(existing.map((c) => [c.slot, c]));
                    const row = slotButtons(bySlot);

                    const msg = await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Create Character")
                                .setDescription(`Choose a slot for **${name}**.`),
                        ],
                        components: [row],
                        fetchReply: true,
                        ephemeral: true, // picker should be ephemeral
                    });

                    savePending(msg.id, userId, name);
                    return;
                }

                // character delete
                if (sub === "delete") {
                    const name = interaction.options.getString("name", true);
                    const { deleted, slot } = deleteCharByName(userId, name);
                    if (!deleted) {
                        return interaction.reply({ content: `❌ No character named **${name}** found.` });
                    }
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Character Deleted")
                                .setDescription(`Removed **${name}** from slot **${slot}**.`),
                        ],
                    });
                }

                // character rename
                if (sub === "rename") {
                    const slot = interaction.options.getInteger("slot", true);
                    const newName = interaction.options.getString("name", true);
                    const res = renameChar(userId, slot, newName);
                    if (!res.ok) {
                        return interaction.reply({ content: `❌ No character in slot **${slot}** to rename.` });
                    }
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Character Renamed")
                                .setDescription(`Slot **${slot}** is now **${newName}**.`),
                        ],
                    });
                }

                // character list
                if (sub === "list") {
                    const target = interaction.options.getUser("user") ?? interaction.user;
                    const rows = getCharsByUser(target.id);
                    const pretty = displayNameOf(interaction, target);
                    const self = target.id === interaction.user.id;
                    const desc = rows.length
                        ? rows.map((r) => `**Slot ${r.slot}** — ${r.name} • ${credits(r.money)}`).join("\n")
                        : `*${self ? "You have" : `${pretty} has`} no characters yet.*`;

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`${self ? displayNameOf(interaction, interaction.user) : pretty}'s Characters`)
                                .setDescription(desc),
                        ],
                    });
                }
            }

            // Balance command
            if (interaction.commandName === "bal") {
                const target = interaction.options.getUser("user") ?? interaction.user;
                const chars = getCharsByUser(target.id);
                const pretty = displayNameOf(interaction, target);

                if (chars.length === 0) {
                    return interaction.reply({
                        content: `❌ ${target.id === interaction.user.id ? "You have" : `${pretty} has`} no characters.`,
                    });
                }

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

                const row = characterSelectRow(
                    chars,
                    `pick_bal_${target.id}`,
                    `Choose a character (${pretty})`
                );
                return interaction.reply({
                    embeds: [new EmbedBuilder().setTitle(`Choose a character:`)],
                    components: [row],
                    ephemeral: true,
                });
            }

            // Inventory command
            if (interaction.commandName === "inv") {
                const target = interaction.options.getUser("user") ?? interaction.user;
                const chars = getCharsByUser(target.id);
                const pretty = displayNameOf(interaction, target);

                if (chars.length === 0) {
                    return interaction.reply({
                        content: `❌ ${target.id === interaction.user.id ? "You have" : `${pretty} has`} no characters.`,
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

                const row = characterSelectRow(
                    chars,
                    `pick_inv_${target.id}`,
                    `Choose a character (${pretty})`
                );
                return interaction.reply({
                    embeds: [new EmbedBuilder().setTitle(`Choose a character:`)],
                    components: [row],
                    ephemeral: true,
                });
            }

            // Add credits command
            if (interaction.commandName === "addcredits") {
                if (!hasModPerms(interaction)) {
                    return interaction.reply({ content: "❌ You don't have permission to use this." });
                }

                const target = interaction.options.getUser("user", true);
                const slot = interaction.options.getInteger("slot", true);
                const amount = interaction.options.getInteger("amount", true);

                if (![1, 2, 3].includes(slot) || amount <= 0) {
                    return interaction.reply({ content: "❌ Slot must be 1-3 and amount must be ≥ 1." });
                }

                const char = getCharByUserSlot(target.id, slot);
                if (!char) {
                    return interaction.reply({ content: `❌ No character for **${displayNameOf(interaction, target)}** in slot **${slot}**.` });
                }

                db.prepare(`UPDATE characters SET money = money + ? WHERE id = ?`).run(amount, char.id);
                const updated = getCharByUserSlot(target.id, slot);

                return interaction.reply(
                    `✅ Added **${fmt(amount)}** ${CRED_EMOJI} to **${displayNameOf(interaction, target)}** (${updated.name}). ` +
                    `New balance: ${credits(updated.money)}`
                );
            }

            // Remove credits command
            if (interaction.commandName === "removecredits") {
                if (!hasModPerms(interaction)) {
                    return interaction.reply({ content: "❌ You don't have permission to use this." });
                }

                const target = interaction.options.getUser("user", true);
                const slot = interaction.options.getInteger("slot", true);
                const amount = interaction.options.getInteger("amount", true);

                if (![1, 2, 3].includes(slot) || amount <= 0) {
                    return interaction.reply({ content: "❌ Slot must be 1-3 and amount must be ≥ 1." });
                }

                const char = getCharByUserSlot(target.id, slot);
                if (!char) {
                    return interaction.reply({ content: `❌ No character for **${displayNameOf(interaction, target)}** in slot **${slot}**.` });
                }
                if (char.money < amount) {
                    return interaction.reply(
                        `❌ Not enough credits. Current: ${credits(char.money)} • Tried to remove **${fmt(amount)}**.`
                    );
                }

                db.prepare(`UPDATE characters SET money = money - ? WHERE id = ?`).run(amount, char.id);
                const updated = getCharByUserSlot(target.id, slot);

                return interaction.reply(
                    `✅ Removed **${fmt(amount)}** ${CRED_EMOJI} from **${displayNameOf(interaction, target)}** (${updated.name}). ` +
                    `New balance: ${credits(updated.money)}`
                );
            }
        }
        // Leaderboard command
        if (interaction.commandName === "leaderboard") {
            const rows = top25Characters();

            if (rows.length === 0) {
                return interaction.reply({ content: "No characters exist yet." });
            }

            const lines = rows.map((r, i) =>
                `**${i + 1}.** **${r.name}** — ${credits(r.money)} • <@${r.user_id}>`
            ).join("\n");

            const embed = new EmbedBuilder()
                .setTitle("Leaderboard")
                .setDescription(lines)

            return interaction.reply({ embeds: [embed] });
        }


        /* ---------- Component interactions ---------- */
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
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Character Created")
                        .setColor(0x57f287)
                        .setDescription(`Created **${pending.name}** in slot **${slot}**.`),
                ],
                components: [],
            });
        }

        // Select menus
        if (interaction.isStringSelectMenu()) {
            const cid = interaction.customId;
            if (cid.startsWith("pick_bal_")) {
                const targetId = cid.slice("pick_bal_".length);
                const value = interaction.values[0];
                if (value === "none") {
                    return interaction.update({ content: "No characters yet.", embeds: [], components: [] });
                }

                const row = db.prepare(
                    `SELECT name, money FROM characters WHERE id = ? AND user_id = ?`
                ).get(value, targetId);

                if (!row) {
                    return interaction.update({ content: "❌ Character not found.", embeds: [], components: [] });
                }

                await interaction.update({ content: "✅ Done.", components: [], embeds: [] });
                await interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`${row.name} — Balance`)
                            .setDescription("## " + credits(row.money)),
                    ],
                });
                return;
            }

            if (cid.startsWith("pick_inv_")) {
                const targetId = cid.slice("pick_inv_".length);
                const value = interaction.values[0];
                if (value === "none") {
                    return interaction.update({ content: "No characters yet.", embeds: [], components: [] });
                }

                const owner = db.prepare(
                    `SELECT id, name FROM characters WHERE id = ? AND user_id = ?`
                ).get(value, targetId);

                if (!owner) {
                    return interaction.update({ content: "❌ Character not found.", embeds: [], components: [] });
                }

                const items = listInventory(Number(value));
                const lines = items.length ? items.map(i => `• ${i.item} × ${i.qty}`).join("\n") : "*Empty*";

                await interaction.update({ content: "✅ Done.", components: [], embeds: [] });
                await interaction.followUp({
                    embeds: [new EmbedBuilder().setTitle(`${owner.name} — Inventory`).setDescription(lines)],
                });
                return;
            }


            // Fallback
            return interaction.update({ content: "❌ Unknown picker context.", components: [] });
        }
    } catch (err) {
        console.error(err);
        if (interaction.isRepliable()) {
            const msg = "Something went wrong. (Check bot logs)";
            try {
                if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg });
                else await interaction.reply({ content: msg });
            } catch { }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
