import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "dotenv"; config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, TEST_GUILD_ID } = process.env;

const charCmd = new SlashCommandBuilder()
  .setName("char").setDescription("Character management")
  .addSubcommand(sc => sc.setName("create").setDescription("Create a character")
    .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true)))
  .addSubcommand(sc => sc.setName("delete").setDescription("Delete by name")
    .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true)))
  .addSubcommand(sc => sc.setName("rename").setDescription("Rename a slot")
    .addIntegerOption(o => o.setName("slot").setDescription("Slot 1-3").setRequired(true)
      .addChoices({name:"Slot 1",value:1},{name:"Slot 2",value:2},{name:"Slot 3",value:3}))
    .addStringOption(o => o.setName("name").setDescription("New name").setRequired(true)))
  .addSubcommand(sc =>
    sc.setName("list")
      .setDescription("List characters (optionally for another user)")
      .addUserOption(o =>
        o.setName("user").setDescription("Whose characters to list (optional)")
      )
  );

const balCmd = new SlashCommandBuilder()
  .setName("bal")
  .setDescription("Show balance for a character (skips picker if only one)")
  .addUserOption(o =>
    o.setName("user").setDescription("Whose balance to view (optional)")
  );
const invCmd = new SlashCommandBuilder()
  .setName("inv")
  .setDescription("Show inventory for a character")
  .addUserOption(o =>
    o.setName("user").setDescription("Whose inventory to view (optional)")
  );

const addCredits = new SlashCommandBuilder()
  .setName("addcredits")
  .setDescription("Add credits to a user's character slot")
  .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
  .addIntegerOption(o => o.setName("slot").setDescription("Slot 1–3").setRequired(true)
    .addChoices({name:"Slot 1",value:1},{name:"Slot 2",value:2},{name:"Slot 3",value:3}))
  .addIntegerOption(o => o.setName("amount").setDescription("Amount to add (>=1)").setRequired(true));

const removeCredits = new SlashCommandBuilder()
  .setName("removecredits")
  .setDescription("Remove credits from a user's character slot")
  .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
  .addIntegerOption(o => o.setName("slot").setDescription("Slot 1–3").setRequired(true)
    .addChoices({name:"Slot 1",value:1},{name:"Slot 2",value:2},{name:"Slot 3",value:3}))
  .addIntegerOption(o => o.setName("amount").setDescription("Amount to remove (>=1)").setRequired(true));

const leaderboardCmd = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top characters");

const commands = [charCmd, balCmd, invCmd, addCredits, removeCredits, leaderboardCmd].map(c => c.toJSON());
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, TEST_GUILD_ID), { body: commands });
console.log("✓ Commands deployed to guild:", TEST_GUILD_ID);
