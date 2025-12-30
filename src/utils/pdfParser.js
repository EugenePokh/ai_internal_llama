// src/utils/pdfReader.js

/**
 * Простой парсер PDF без внешних библиотек
 * Извлекает текст из бинарных данных PDF
 */
export const extractTextFromPDF = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        
        // Пробуем извлечь текст разными методами
        const methods = [
          extractWithTextDecoder,
          extractWithRegex,
          extractWithBinarySearch
        ];
        
        let bestResult = '';
        
        for (const method of methods) {
          try {
            const result = await method(arrayBuffer);
            if (result && result.length > bestResult.length) {
              bestResult = result;
            }
          } catch (e) {
            // Игнорируем ошибки методов
          }
        }
        
        // Форматируем результат
        const formattedResult = formatPDFResult(file.name, bestResult);
        resolve(formattedResult);
        
      } catch (error) {
        console.warn('Ошибка обработки PDF:', error);
        resolve(`📄 PDF файл: ${file.name}\n⚠️ Не удалось обработать файл\nРазмер: ${(file.size / 1024).toFixed(1)} KB`);
      }
    };
    
    reader.onerror = () => {
      resolve(`📄 PDF файл: ${file.name}\n❌ Ошибка чтения файла`);
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Метод 1: Используем TextDecoder
 */
const extractWithTextDecoder = async (arrayBuffer) => {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(arrayBuffer);
  
  // Ищем текст в диапазоне ASCII
  const asciiText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  const lines = asciiText.split('\n').filter(line => line.trim().length > 20);
  
  return lines.slice(0, 50).join('\n');
};

/**
 * Метод 2: Используем регулярные выражения
 */
const extractWithRegex = async (arrayBuffer) => {
  const uint8Array = new Uint8Array(arrayBuffer);
  let text = '';
  
  // Сканируем первые 200KB файла
  for (let i = 0; i < Math.min(uint8Array.length, 200000); i++) {
    const charCode = uint8Array[i];
    
    // Ищем последовательности печатных символов
    if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13) {
      text += String.fromCharCode(charCode);
    } else if (charCode === 9) {
      text += ' '; // Табуляция -> пробел
    } else if (text.length > 0 && !text.endsWith(' ')) {
      text += ' '; // Добавляем пробел между блоками
    }
  }
  
  // Очищаем текст
  return text
    .replace(/\s+/g, ' ')
    .replace(/(\w) (\w)/g, '$1$2') // Убираем лишние пробелы между словами
    .trim();
};

/**
 * Метод 3: Ищем текст в бинарных данных
 */
const extractWithBinarySearch = async (arrayBuffer) => {
  const textChunks = [];
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Ищем начало текстовых объектов в PDF
  for (let i = 0; i < Math.min(uint8Array.length - 10, 100000); i++) {
    // Ищем паттерны типа "BT" (Begin Text) или "Td" (Text positioning)
    if (uint8Array[i] === 66 && uint8Array[i + 1] === 84) { // "BT"
      let j = i + 2;
      let chunk = '';
      
      // Собираем текст до "ET" (End Text)
      while (j < uint8Array.length && !(uint8Array[j] === 69 && uint8Array[j + 1] === 84)) {
        if (uint8Array[j] >= 32 && uint8Array[j] <= 126) {
          chunk += String.fromCharCode(uint8Array[j]);
        }
        j++;
      }
      
      if (chunk.length > 10) {
        textChunks.push(chunk);
      }
    }
  }
  
  return textChunks.join(' ').substring(0, 5000);
};

/**
 * Форматирует результат
 */
const formatPDFResult = (fileName, text) => {
  if (!text || text.length < 50) {
    return `📄 PDF файл: ${fileName}\n\n⚠️ Текст не найден или файл содержит только изображения.\n\nРекомендации:\n1. Используйте OCR версию PDF\n2. Конвертируйте в TXT онлайн\n3. Скопируйте текст из PDF вручную`;
  }
  
  const limitedText = text.length > 5000 
    ? text.substring(0, 5000) + '\n\n[Текст обрезан]' 
    : text;
  
  return `📄 PDF файл: ${fileName}\n\n📝 Извлеченный текст:\n${limitedText}`;
};

/**
 * Проверяет, является ли файл текстовым PDF
 */
export const isTextPDF = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const uint8Array = new Uint8Array(event.target.result.slice(0, 1000));
        const header = Array.from(uint8Array.slice(0, 10))
          .map(b => String.fromCharCode(b))
          .join('');
        
        // Проверяем PDF сигнатуру
        const isPDF = header.includes('%PDF');
        
        // Проверяем наличие текста в начале файла
        let hasText = false;
        for (let i = 0; i < Math.min(uint8Array.length, 1000); i++) {
          if ((uint8Array[i] >= 65 && uint8Array[i] <= 90) || 
              (uint8Array[i] >= 97 && uint8Array[i] <= 122)) {
            hasText = true;
            break;
          }
        }
        
        resolve(isPDF && hasText);
      } catch (error) {
        resolve(false);
      }
    };
    
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 1000));
  });
};