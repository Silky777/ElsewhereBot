# ElsewhereBot

ElsewhereBot is a Discord bot designed to manage characters, their inventories, and balances within a game-like environment. This bot allows users to create characters, manage their credits, and interact with various commands to enhance their experience.

## Features

- **Character Management**: Create, delete, and rename characters.
- **Balance Tracking**: Check the balance of characters and manage credits.
- **Inventory Management**: View and manage items in a character's inventory.
- **Leaderboard**: Display the top characters based on their balance.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd ElsewhereBot
   ```
3. Install the dependencies:
   ```
   npm install
   ```
4. Create a `.env` file based on the `.env.example` file and fill in your Discord bot token and database path.

## Usage

To start the bot, run:
```
npm start
```

## Commands

- `/char create <name>`: Create a new character with the specified name.
- `/char delete <name>`: Delete a character by name.
- `/char rename <slot> <newName>`: Rename a character in the specified slot.
- `/bal [user]`: Check the balance of a character.
- `/inv [user]`: View the inventory of a character.
- `/addcredits <user> <slot> <amount>`: Add credits to a character's balance.
- `/removecredits <user> <slot> <amount>`: Remove credits from a character's balance.
- `/leaderboard`: Display the leaderboard of top characters.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.