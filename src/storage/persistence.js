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
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('[Persistence] Erro ao salvar dados:', e.message);
    }
  }

  _parseDataFile(filePath, defaults) {
    try {
      return JSON.parse(fs.readFileSync(filePath));
    } catch (error) {
      // Retorna default se não conseguir ler
      return defaults;
    }
  }
}

module.exports = Store;
