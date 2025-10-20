#!/bin/bash

# Скрипт для очистки всех процессов бота и файлов PID

echo "🧹 Очистка процессов бота..."

# Убиваем все процессы Node.js связанные с ботом
echo "🔍 Поиск процессов бота..."
pids=$(ps aux | grep -E "(gifts-monitor-bot|ts-node.*index\.ts|node.*dist/index\.js)" | grep -v grep | awk '{print $2}')

if [ -n "$pids" ]; then
    echo "📋 Найдены процессы: $pids"
    echo "🔴 Завершение процессов..."
    for pid in $pids; do
        echo "  - Завершаем процесс $pid"
        kill -TERM $pid 2>/dev/null || true
    done
    
    # Ждем 3 секунды
    sleep 3
    
    # Принудительно убиваем оставшиеся процессы
    for pid in $pids; do
        if kill -0 $pid 2>/dev/null; then
            echo "  - Принудительно завершаем процесс $pid"
            kill -KILL $pid 2>/dev/null || true
        fi
    done
else
    echo "✅ Процессы бота не найдены"
fi

# Удаляем файл PID
if [ -f "bot.pid" ]; then
    echo "🗑️ Удаляем файл bot.pid"
    rm -f bot.pid
fi

# Удаляем временные файлы
echo "🧽 Очистка временных файлов..."
rm -f *.log
rm -f logs/*.log 2>/dev/null || true

echo "✅ Очистка завершена!"
echo ""
echo "Теперь можно безопасно запустить бота:"
echo "  npm run bot:dev"
echo "  или"
echo "  npm start"
