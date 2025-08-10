import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import commandHandler from './handlers/commandHandler.js';
import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

await commandHandler(client);

client.once('ready', () => {
  readyEvent(client);
});

interactionCreateEvent(client);

client.login(process.env.DISCORD_TOKEN);