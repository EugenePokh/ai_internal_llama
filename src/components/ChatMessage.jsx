import React from 'react';
import { FaUser, FaRobot, FaExclamationTriangle } from 'react-icons/fa';

const ChatMessage = ({ message }) => {
  const getIcon = () => {
    switch (message.sender) {
      case 'user':
        return <FaUser className="icon user-icon" />;
      case 'ai':
        return <FaRobot className="icon ai-icon" />;
      case 'error':
        return <FaExclamationTriangle className="icon error-icon" />;
      default:
        return null;
    }
  };

  const getSenderName = () => {
    switch (message.sender) {
      case 'user':
        return 'Вы';
      case 'ai':
        return message.model ? `ИИ (${message.model})` : 'ИИ';
      case 'error':
        return 'Ошибка';
      default:
        return 'Неизвестно';
    }
  };

  return (
    <div className={`chat-message ${message.sender}`}>
      <div className="message-header">
        {getIcon()}
        <div className="sender-info">
          <span className="sender-name">{getSenderName()}</span>
          <span className="timestamp">{message.timestamp}</span>
        </div>
      </div>
      
      <div className="message-content">
        <p>{message.text}</p>
        
        {message.files && message.files.length > 0 && (
          <div className="message-files">
            <p className="files-label">Прикрепленные файлы:</p>
            <div className="files-list">
              {message.files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {message.model && message.sender === 'ai' && (
          <div className="model-info">
            <small>Модель: {message.model}</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;