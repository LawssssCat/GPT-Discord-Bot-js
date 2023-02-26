// .env
require('dotenv').config();

module.exports = {
  "Prefix": "bot:",
  "MainColor": "#54AEFF",
  "ErrorColor": "#E81224",
  "ClientID": process.env.DISCORD_CLIENT_ID,
  "Token": process.env.DISCORD_TOKEN,
  "OpenAIapiKey": process.env.OPENAI_KEY,
}