import { REST, Routes } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv"; config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, TEST_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !TEST_GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or TEST_GUILD_ID");
  process.exit(1);
}

const commandsUrl = new URL("./commands/", import.meta.url);
const dirPath = fileURLToPath(commandsUrl);
const files = readdirSync(dirPath).filter(f => f.endsWith(".js"));

const modules = await Promise.all(files.map(f => import(new URL(f, commandsUrl).href)));
const commandData = modules
  .map(m => (m.default ?? m).data)
  .filter(Boolean)
  .map(d => d.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, TEST_GUILD_ID), { body: commandData });

console.log(`✓ Deployed ${commandData.length} commands to guild ${TEST_GUILD_ID}:`, files.join(", "));
