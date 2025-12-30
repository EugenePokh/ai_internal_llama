import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChatMessage from './components/ChatMessage';
import FileUploader from './components/FileUploader';
import ModelSelector from './components/ModelSelector';
import { extractTextFromPDF } from './utils/pdfParser';
import './App.css';

// Функция для форматирования имени модели
const formatModelName = (modelId) => {
  const modelNames = {
    'llama3.2:1b': 'Llama 3.2 1B',
    'llama3.2:3b': 'Llama 3.2 3B',
    'phi3:mini': 'Phi-3 Mini',
    'mistral:7b': 'Mistral 7B',
    'qwen2.5:0.5b': 'Qwen 2.5 0.5B',
  };
  return modelNames[modelId] || modelId;
};

// Функция для чтения содержимого файла (с pdfjs-dist)
const readFileContent = async (file) => {
  // Для текстовых файлов
  if (file.type.includes('text/') || 
      file.type === 'application/json' || 
      file.name.endsWith('.txt') || 
      file.name.endsWith('.md') || 
      file.name.endsWith('.json')) {
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const limitedContent = content.length > 5000 
          ? content.substring(0, 5000) + '\n\n[Текст обрезан]' 
          : content;
        resolve(`Текстовый файл "${file.name}":\n${limitedContent}`);
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  } 
  // Для PDF файлов
  else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      const pdfText = await extractTextFromPDF(file, {
        maxPages: 10,      // Можно уменьшить для скорости
        maxChars: 15000,   // Увеличим лимит для PDF
      });
      return pdfText;
    } catch (error) {
      console.error('Ошибка чтения PDF:', error);
      return `PDF файл "${file.name}"\n\nОшибка: ${error.message}\n\nПопробуйте:\n1. Убедиться что PDF не защищен паролем\n2. Использовать текстовую версию файла`;
    }
  }
  // Для других файлов
  else {
    return `Файл "${file.name}" (${file.type})\n\n[Неподдерживаемый формат]`;
  }
};

// Основной компонент App (остальной код остается прежним)
function App() {
  // Состояния
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState('llama3.2:1b');
  const [systemPrompt, setSystemPrompt] = useState('Ты полезный ассистент. Отвечай на русском языке. Используй информацию из предоставленных файлов для ответов.');
  const [availableModels, setAvailableModels] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [pdfWorkerLoaded, setPdfWorkerLoaded] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Инициализация PDF.js worker
  useEffect(() => {
    // Проверяем загрузку PDF worker
    const checkPDFWorker = () => {
      if (window.pdfjsLib) {
        setPdfWorkerLoaded(true);
        console.log('PDF.js worker загружен');
      }
    };
    
    // Пробуем несколько раз проверить загрузку
    const timer = setInterval(checkPDFWorker, 1000);
    setTimeout(() => clearInterval(timer), 5000);
    
    return () => clearInterval(timer);
  }, []);

  // Загрузка установленных моделей
  const loadInstalledModels = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        const models = data.models.map(model => ({
          id: model.name,
          name: formatModelName(model.name)
        }));
        setAvailableModels(models);
        
        // Выбираем первую модель, если выбрана несуществующая
        if (models.length > 0 && !models.some(m => m.id === selectedModel)) {
          setSelectedModel(models[0].id);
        }
        
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error('Ошибка загрузки моделей:', error);
      // Используем дефолтную модель
      setAvailableModels([
        { id: 'llama3.2:1b', name: 'Llama 3.2 1B' }
      ]);
      setConnectionStatus('error');
    }
  }, [selectedModel]);

  // Проверка подключения к Ollama
  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        alert(`✅ Подключение успешно!\n\nДоступные модели:\n${data.models.map(m => `- ${m.name}`).join('\n')}`);
        setConnectionStatus('connected');
        loadInstalledModels();
      } else {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }
    } catch (error) {
      alert(`❌ Не удалось подключиться к Ollama\n\nПричина: ${error.message}\n\nУбедитесь что:\n1. Ollama установлена и запущена\n2. Сервер доступен на http://localhost:11434`);
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Инициализация при загрузке
  useEffect(() => {
    loadInstalledModels();
  }, [loadInstalledModels]);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Отправка сообщения
  const handleSendMessage = async () => {
    if ((!input.trim() && files.length === 0) || isLoading) return;

    // Добавляем сообщение пользователя
    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString(),
      files: [...files],
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setFiles([]);
    setIsLoading(true);

    try {
      // Подготавливаем контекст из файлов
      let context = '';
      if (files.length > 0) {
        const fileContents = await Promise.all(
          files.map(file => readFileContent(file))
        );
        context = `Контекст из файлов:\n${fileContents.join('\n\n')}\n\n`;
        
        // Добавляем информацию о PDF worker если есть PDF файлы
        const hasPDF = files.some(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (hasPDF && !pdfWorkerLoaded) {
          context += '[Примечание: PDF файлы могут обрабатываться медленнее]\n\n';
        }
      }

      // Формируем промпт
      const prompt = `${systemPrompt}\n\n${context}Вопрос: ${currentInput}\n\nОтвет на русском языке:`;

      // Отправляем запрос в Ollama
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_ctx: 2048,
            num_gpu: 20,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status}`);
      }

      const data = await response.json();

      // Добавляем ответ от ИИ
      const aiMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString(),
        model: selectedModel,
      };

      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('Ошибка отправки:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        text: `Ошибка: ${error.message}`,
        sender: 'error',
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка новой модели
  const handleLoadModel = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedModel,
          stream: false,
        }),
      });
      
      if (response.ok) {
        alert(`✅ Модель ${selectedModel} успешно загружена!`);
        loadInstalledModels();
      } else {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }
    } catch (error) {
      alert(`❌ Ошибка загрузки модели: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Очистка чата
  const handleClearChat = () => {
    if (window.confirm('Очистить всю историю чата?')) {
      setMessages([]);
      setFiles([]);
    }
  };

  // Обработка нажатия клавиш
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Быстрый тест модели
  const handleQuickTest = async () => {
    if (isLoading) return;
    
    const testMessage = {
      id: Date.now(),
      text: "Привет! Расскажи о себе в двух предложениях на русском языке.",
      sender: 'user',
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages([testMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: 'Привет! Расскажи о себе в двух предложениях на русском языке.',
          stream: false,
        }),
      });

      const data = await response.json();
      
      const aiMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString(),
        model: selectedModel,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      alert(`Ошибка теста: ${error.message}\n\nПроверьте подключение к Ollama`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ollama Chat</h1>
        <div className="header-controls">
          <div className="model-section">
            <ModelSelector
              models={availableModels}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              disabled={isLoading}
            />
            <button 
              onClick={handleLoadModel}
              disabled={isLoading}
              className="load-btn"
              title="Загрузить выбранную модель"
            >
              ⬇️ Загрузить
            </button>
          </div>
          
          <div className="action-buttons">
            <button 
              onClick={testConnection}
              disabled={isLoading}
              className={`test-btn ${connectionStatus}`}
              title="Проверить подключение к Ollama"
            >
              {connectionStatus === 'connected' ? '✅' : 
               connectionStatus === 'error' ? '❌' : '🔗'} Подключение
            </button>
            
            <button 
              onClick={handleQuickTest}
              disabled={isLoading}
              className="test-btn"
              title="Быстрый тест модели"
            >
              Быстрый тест
            </button>
            
            <button 
              className="clear-btn" 
              onClick={handleClearChat}
              disabled={isLoading}
              title="Очистить чат"
            >
              Очистить
            </button>
          </div>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <div className="welcome-section">
                <h3>Добро пожаловать в Ollama Chat!</h3>
                <p>Общайтесь с локальным ИИ на вашем компьютере</p>
                
                <div className="connection-status">
                  <div className={`status-indicator ${connectionStatus}`}>
                    {connectionStatus === 'connected' ? '✅ Подключено' : 
                     connectionStatus === 'error' ? '❌ Ошибка подключения' : '🔄 Проверка...'}
                  </div>
                  <p>Модель: <strong>{selectedModel}</strong></p>
                  {pdfWorkerLoaded && (
                    <p className="pdf-status">✅ PDF обработчик готов</p>
                  )}
                </div>
              </div>
              
              <div className="tips-section">
                <h4>Как использовать:</h4>
                <ul>
                  <li><strong>Напишите сообщение</strong> в поле ниже</li>
                  <li><strong>Загрузите файлы</strong> для анализа (txt, pdf, md, json)</li>
                  <li><strong>Используйте Enter</strong> для отправки сообщения</li>
                  <li><strong>Shift+Enter</strong> для новой строки</li>
                </ul>
                
                <div className="file-types">
                  <h5>📎 Поддерживаемые файлы:</h5>
                  <div className="file-tags">
                    <span className="file-tag">TXT</span>
                    <span className="file-tag">PDF</span>
                    <span className="file-tag">MD</span>
                    <span className="file-tag">JSON</span>
                  </div>
                  <p className="file-note">
                    PDF файлы теперь поддерживаются через pdfjs-dist
                  </p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))
          )}
          
          {isLoading && (
            <div className="loading-message">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Модель думает{files.some(f => f.type === 'application/pdf') ? ' (обработка PDF...)' : ''}...</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="system-prompt-section">
            <label htmlFor="system-prompt">Системный промпт:</label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Инструкции для ИИ..."
              className="system-prompt-input"
              rows="2"
              disabled={isLoading}
            />
          </div>

          <FileUploader files={files} setFiles={setFiles} isLoading={isLoading} />

          <div className="input-section">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Введите ваше сообщение... (Enter для отправки, Shift+Enter для новой строки)"
              className="message-input"
              rows="3"
              disabled={isLoading}
            />
            <div className="input-actions">
              <button
                onClick={handleSendMessage}
                disabled={isLoading || (!input.trim() && files.length === 0)}
                className="send-btn"
                title="Отправить сообщение"
              >
                {isLoading ? (
                  <span className="sending">⏳</span>
                ) : (
                  <span className="send-icon">Отправить</span>
                )}
              </button>
            </div>
          </div>

          <div className="status-bar">
            <div className="status-item">
              <span className="status-label">Модель:</span>
              <span className="status-value">{selectedModel}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Сообщений:</span>
              <span className="status-value">{messages.length}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Файлов:</span>
              <span className="status-value">{files.length}/5</span>
              {files.some(f => f.type === 'application/pdf') && (
                <span className="pdf-indicator">📄</span>
              )}
            </div>
            <div className="status-item">
              <span className="status-label">Статус:</span>
              <span className={`status-value ${connectionStatus}`}>
                {connectionStatus === 'connected' ? '✅' : 
                 connectionStatus === 'error' ? '❌' : '🔄'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;