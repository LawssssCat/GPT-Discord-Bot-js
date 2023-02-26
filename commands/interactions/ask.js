const Discord = require('discord.js');
const openAI = require('openai');
const chalk = require('chalk');
const fs = require('node:fs');
const func = require('../../utils/functions');
const tokenizer = require('../../utils/encoder/encoder');
const settings = require('../../utils/settings');
const config = require('../../configs/configs');

module.exports = {
    data: new Discord.SlashCommandBuilder()
        .setName("ask")
        .setDescription("Answers your questions!")
        .addStringOption(option => option
            .setName("prompt")
            .setDescription("What is your question?")
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('ephemeral')
            .setDescription('Hides the bot\'s reply from others. (Default: Disable)')
            .addChoices(
                {
                    name: 'Enable',
                    value: 'Enable'
                },
                {
                    name: 'Disable',
                    value: 'Disable'
                }
            )
        ),

    async execute(client, interaction) {

        const ephemeralChoice = interaction.options.getString('ephemeral');
        const ephemeral = ephemeralChoice === 'Enable' ? true : false;
        await interaction.deferReply({ ephemeral: ephemeral });

        const configuration = new openAI.Configuration({ apiKey: config.OpenAIapiKey });
        const openai = new openAI.OpenAIApi(configuration);

        const question = interaction.options.getString("prompt");

        openai.createModeration({

            input: question

        }).then(async (response) => {

            const data = response.data.results[0];
            if (data.flagged) {

                const logEmbed = new Discord.EmbedBuilder()
                    .setColor(config.ErrorColor)
                    .setAuthor({
                        name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setDescription(`Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowd by our safety system\n\n**Flags:** ${func.flagCheck(data.categories).trueFlags}`);

                await interaction.editReply({ embeds: [logEmbed] });

            } else {

                const chatGPTprompt = fs.readFileSync("./utils/prompts/chatGPTask.txt", "utf-8");
                const prompt = chatGPTprompt
                    .replaceAll('{botUsername}', client.user.username)
                    .replaceAll('{userUsername}', interaction.user.username)
                    .replaceAll('{question}', question);
                const encoded = tokenizer.encode(prompt);
                const maxTokens = 4096 - encoded.length;

                openai.createCompletion({

                    model: settings.chatGPT.model,
                    prompt: prompt,
                    max_tokens: maxTokens,
                    temperature: settings.chatGPT.temprature,
                    top_p: settings.chatGPT.top_p,
                    frequency_penalty: settings.chatGPT.frequency_penalty,
                    presence_penalty: settings.chatGPT.presence_penalty

                }).then(async (response) => {

                    const answer = response.data.choices[0].text;
                    const usage = response.data.usage;

                    openai.createModeration({

                        input: answer

                    }).then(async (response) => {

                        const data = response.data.results[0];
                        if (data.flagged) {

                            const embed = new Discord.EmbedBuilder()
                                .setColor(config.ErrorColor)
                                .setAuthor({
                                    name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                                    iconURL: interaction.user.displayAvatarURL()
                                })
                                .setDescription(`Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowd by our safety system\n\n**Flags:** ${func.flagCheck(data.categories).trueFlags}`)
                                .setFooter({
                                    text: `Costs ${func.pricing('davinci', usage.total_tokens)}`,
                                    iconURL: client.user.displayAvatarURL()
                                });

                            return interaction.editReply({ embeds: [embed] });

                        } else {

                            if (answer.length < 4096) {

                                const embed = new Discord.EmbedBuilder()
                                    .setColor(config.MainColor)
                                    .setAuthor({
                                        name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                                        iconURL: interaction.user.displayAvatarURL()
                                    })
                                    .setDescription(answer)
                                    .setFooter({
                                        text: `Costs ${func.pricing('davinci', usage.total_tokens)}`,
                                        iconURL: client.user.displayAvatarURL()
                                    });

                                await interaction.editReply({ embeds: [embed] });

                            } else {

                                const attachment = new Discord.AttachmentBuilder(
                                    Buffer.from(`${question}\n\n${answer}`, 'utf-8'),
                                    { name: 'response.txt' }
                                );
                                
                                await interaction.editReply({ files: [attachment] });

                            };

                        };

                    }).catch(async (error) => {

                        console.error(chalk.bold.redBright(error));

                        if (error.response) {

                            const embed = new Discord.EmbedBuilder()
                                .setColor(config.ErrorColor)
                                .setAuthor({
                                    name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                                    iconURL: interaction.user.displayAvatarURL()
                                })
                                .setDescription(error.response.data.error.message);

                            await interaction.editReply({ embeds: [embed] }).catch(() => null);

                        } else if (error.message) {

                            const embed = new Discord.EmbedBuilder()
                                .setColor(config.ErrorColor)
                                .setAuthor({
                                    name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                                    iconURL: interaction.user.displayAvatarURL()
                                })
                                .setDescription(error.message);

                            await interaction.editReply({ embeds: [embed] }).catch(() => null);

                        };

                    });

                }).catch(async (error) => {

                    console.error(chalk.bold.redBright(error));

                    if (error.response) {

                        const embed = new Discord.EmbedBuilder()
                            .setColor(config.ErrorColor)
                            .setAuthor({
                                name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                                iconURL: interaction.user.displayAvatarURL()
                            })
                            .setDescription(error.response.data.error.message);

                        await interaction.editReply({ embeds: [embed] }).catch(() => null);

                    } else if (error.message) {

                        const embed = new Discord.EmbedBuilder()
                            .setColor(config.ErrorColor)
                            .setAuthor({
                                name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                                iconURL: interaction.user.displayAvatarURL()
                            })
                            .setDescription(error.message);

                        await interaction.editReply({ embeds: [embed] }).catch(() => null);

                    };

                });

            };

        }).catch(async (error) => {

            console.error(chalk.bold.redBright(error));

            if (error.response) {

                const embed = new Discord.EmbedBuilder()
                    .setColor(config.ErrorColor)
                    .setAuthor({
                        name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setDescription(error.response.data.error.message);

                await interaction.editReply({ embeds: [embed] }).catch(() => null);

            } else if (error.message) {

                const embed = new Discord.EmbedBuilder()
                    .setColor(config.ErrorColor)
                    .setAuthor({
                        name: question.length > 256 ? question.substring(0, 253) + "..." : question,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setDescription(error.message);

                await interaction.editReply({ embeds: [embed] }).catch(() => null);

            };

        });

    },

};