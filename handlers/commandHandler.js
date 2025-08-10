import { readdirSync } from "fs";
import { fileURLToPath } from "url";

const commandsUrl = new URL("../commands/", import.meta.url);

export default async function commandHandler(client) {
  client.commands ??= new Map();

  const dirPath = fileURLToPath(commandsUrl);
  const files = readdirSync(dirPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const mod = await import(new URL(file, commandsUrl).href);
    const cmd = mod.default ?? mod.command ?? mod;

    if (!cmd?.data || !cmd?.execute) {
      console.warn(`Skipping ${file}: missing data/execute`);
      continue;
    }

    client.commands.set(cmd.data.name, cmd);
  }

  console.log(`Loaded commands: ${[...client.commands.keys()].join(", ") || "(none)"}`);
}