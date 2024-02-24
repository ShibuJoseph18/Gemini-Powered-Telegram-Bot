import express from 'express';
import bodyParser from 'body-parser';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

const app = express();
app.use(bodyParser.json());

const bot = new TelegramBot(botToken, { polling: true });

const MODEL_NAME = "gemini-1.0-pro";

async function geminiData(data) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const generationConfig = {
        temperature: 0.9,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
    };
    
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];
    
    const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: [],
    });
    
    const result = await chat.sendMessage(data);
    return result.response.text();
}

bot.on('message', async (msg) => {
    console.log(msg);
    const chatId = msg.chat.id;
    const userRequest = msg.text;
    let geminiResponse;

    if (msg.reply_to_message) {
        const userRaiseReply = msg.reply_to_message.text;
        const finalRequest = `Data:${userRaiseReply}\nMy Question:${userRequest}`;
        geminiResponse = await geminiData(finalRequest).catch(error => console.log("Gemini response error:", error));
    } else {
        geminiResponse = await geminiData(userRequest).catch(error => console.log("Gemini response error:", error));
    }
    console.log(geminiResponse);
    try {
        if (geminiResponse && geminiResponse.length > 4096) {
            const chunks = geminiResponse.match(/.{1,4096}/g);
            for (const chunk of chunks) {
                await bot.sendMessage(chatId, chunk);
            }
        } else {
            await bot.sendMessage(chatId, geminiResponse);
        }
    } catch (error) {
        console.log("Problem while sending the message to Telegram:", error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
