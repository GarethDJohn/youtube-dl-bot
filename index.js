require('dotenv').config()
const { Telegraf } = require('telegraf')
const { exec } = require('child_process');
const winston = require('winston');
const envalid = require('envalid');
const { v4: uuidv4 } = require('uuid');

const env = envalid.cleanEnv(process.env, {
    YOUTUBE_DL_BOT_TOKEN: envalid.str(),
    YOUTUBE_DL_BOT_VALID_USERS: envalid.str(),
    YOUTUBE_DL_BOT_LOG_LEVEL: envalid.str({ choices: ['debug', 'info', 'warning', 'error'] }),
    YOUTUBE_DL_BOT_DOWNLOAD_FOLDER: envalid.str(),
});

const logger = winston.createLogger({
    level: env.YOUTUBE_DL_BOT_LOG_LEVEL,
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    ],
});

const validUsers = env.YOUTUBE_DL_BOT_VALID_USERS.split(',').map(x => parseInt(x));

const bot = new Telegraf(env.YOUTUBE_DL_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Welcome!'));
bot.help((ctx) => ctx.reply('Send me a Youtube link and I will download it'));

bot.use(async (ctx, next) => {
    logger.info(`Received message from: ${JSON.stringify(ctx.update.message.from)}`);
    if (validUsers.includes(ctx.update.message.from.id)) {
        logger.info(`User is valid`);
        await next();
    } else {
        logger.warn(`User ${ctx.update.message.from} is not valid, ignoring request`);
    }
});

async function fetchTitle(url) {
    const command = `youtube-dl --skip-download --get-title --no-warnings ${url}`;

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error.message)
            } else {
                if (stderr) {
                    logger.error(`Error received retrieving title: ${stderr}`);
                }
                resolve(stdout);
            }
        });
    });
}

bot.hears(/https:\/\/.*/, async (ctx) => {
    const url = ctx.match[0];
    const outputTemplate = '%(title)s-%(id)s.%(ext)s';

    let title = uuidv4();

    try {
        title = await fetchTitle(url);
    } finally {
        const command = `youtube-dl --merge-output-format mkv --no-warnings -o "${env.YOUTUBE_DL_BOT_DOWNLOAD_FOLDER}/${outputTemplate}" ${url}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`Failed to execute youtube-dl: ${error.message}`);
                ctx.reply(`Failed to execute youtube-dl: ${error.message}`);
            } else if (stderr) {
                console.log(`Failed to download: ${stderr}`);
                ctx.reply(`Failed to download: ${stderr}`);
            } else {
                console.log(`Downloaded ${title} successfully`);
                ctx.reply(`Downloaded ${title} successfully`);
            }
        });
    }


});

bot.launch();
