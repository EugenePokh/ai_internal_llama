import React from 'react';

const ModelSelector = ({ models, selectedModel, onModelChange, onLoadModel }) => {
  return (
    <div className="model-selector">
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="model-select"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      
      
    </div>
  );
};

export default ModelSelector;