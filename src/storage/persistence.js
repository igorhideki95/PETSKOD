// storage/persistence.js
// Gerencia a persistência de configuração usando app.getPath('userData')

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(opts) {
    // userData é a pasta de dados do aplicativo no sistema do usuário (ex: AppData/Roaming/<app-name>)
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.data = this._parseDataFile(this.path, opts.defaults);
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    this.save();
  }

  save() {
    const tempPath = this.path + '.tmp';
    try {
      // 1. Escreve no arquivo temporário
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2));
      // 2. Renomeia atomicamente (se falhar na escrita, o original é preservado)
      fs.renameSync(tempPath, this.path);
    } catch (e) {
      console.error('[Persistence] Erro ao salvar dados:', e.message);
      // Limpa o temporário se algo deu errado
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (err) {}
      }
    }
  }

  _parseDataFile(filePath, defaults) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      if (!data.trim()) return defaults;
      return JSON.parse(data);
    } catch (error) {
      console.warn(`[Persistence] Arquivo inválido ou corrompido: ${filePath}`, error.message);
      return defaults;
    }
  }
}

module.exports = Store;
