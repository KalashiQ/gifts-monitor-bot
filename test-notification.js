// Простой тест для проверки отправки уведомлений
const TelegramBot = require('node-telegram-bot-api');

// Замените на ваш токен бота
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = process.env.TEST_CHAT_ID || 'YOUR_CHAT_ID_HERE';

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ Установите TELEGRAM_BOT_TOKEN в переменных окружения');
  process.exit(1);
}

if (!CHAT_ID || CHAT_ID === 'YOUR_CHAT_ID_HERE') {
  console.error('❌ Установите TEST_CHAT_ID в переменных окружения');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

async function testNotification() {
  try {
    console.log('🧪 Тестирование отправки уведомления...');
    
    const testMessage = `🎁 *Тестовое уведомление*\n\n` +
                       `🎯 *Пресет:* Spring Basket\n` +
                       `🤖 *Модель:* Ritual Goat\n` +
                       `🎨 *Фон:* Spring\n` +
                       `🔍 *Узор:* Ritual\n\n` +
                       `📈 Количество увеличилось: *5* → *6*\n` +
                       `📊 Разница: *1*\n\n` +
                       `🎁 [Посмотреть последний подарок](https://t.me/nft/SpringBasket-92541)\n` +
                       `🔗 [Посмотреть все на peek.tg](https://peek.tg/gifts?gift=Spring%20Basket&model=Ritual%20Goat&background=Spring&pattern=Ritual)\n\n` +
                       `⏰ ${new Date().toLocaleString('ru-RU')}`;

    await bot.sendMessage(CHAT_ID, testMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    console.log('✅ Тестовое уведомление отправлено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка отправки тестового уведомления:', error.message);
  }
}

testNotification();
