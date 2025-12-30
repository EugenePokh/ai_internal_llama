import React, { useCallback } from 'react';
import { FaPaperclip, FaTimes, FaFilePdf } from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';

const FileUploader = ({ files, setFiles, isLoading }) => {
  const onDrop = useCallback((acceptedFiles) => {
    if (isLoading) return;
    
    const validFiles = acceptedFiles.filter(file => {
      const validTypes = [
        'text/plain',
        'text/markdown',
        'application/json',
        'application/pdf'
      ];
      
      const validExtensions = ['.txt', '.md', '.json', '.pdf'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
    });
    
    if (validFiles.length !== acceptedFiles.length) {
      alert('Поддерживаются только файлы: .txt, .md, .json, .pdf');
    }
    
    setFiles(prev => [...prev, ...validFiles].slice(0, 5));
  }, [setFiles, isLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 5,
    maxSize: 10485760, // 10MB
    disabled: isLoading,
  });

  const removeFile = (indexToRemove) => {
    if (isLoading) return;
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const getFileIcon = (file) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      return <FaFilePdf className="pdf-icon" />;
    }
    return <FaPaperclip className="clip-icon" />;
  };

  const getFileTypeText = (file) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'PDF';
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) return 'TXT';
    if (file.type === 'application/json' || file.name.endsWith('.json')) return 'JSON';
    if (file.type === 'text/markdown' || file.name.endsWith('.md')) return 'MD';
    return file.name.split('.').pop().toUpperCase();
  };

  return (
    <div className="file-uploader">
      <div 
        {...getRootProps()} 
        className={`dropzone ${isDragActive ? 'active' : ''} ${isLoading ? 'disabled' : ''}`}
      >
        <input {...getInputProps()} />
        <FaPaperclip className="clip-icon" />
        {isDragActive ? (
          <p>Перетащите файлы сюда...</p>
        ) : (
          <p>Нажмите или перетащите файлы для загрузки (txt, pdf, md, json)</p>
        )}
        {isLoading && <p className="upload-disabled">Загрузка отключена во время обработки</p>}
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <p className="files-count">Загружено файлов: {files.length}/5</p>
          <div className="files-grid">
            {files.map((file, index) => (
              <div key={index} className="file-card">
                <div className="file-info">
                  <div className="file-icon-type">
                    {getFileIcon(file)}
                    <div className="file-details">
                      <span className="file-name" title={file.name}>
                        {file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name}
                      </span>
                      <div className="file-meta">
                        <span className="file-size">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <span className="file-type">
                          {getFileTypeText(file)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => removeFile(index)}
                  className="remove-file-btn"
                  title="Удалить файл"
                  disabled={isLoading}
                >
                  <FaTimes />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;