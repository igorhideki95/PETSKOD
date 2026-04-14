// app/logger.js
// Sistema de logs simplificado com saída colorida e arquivo persistente

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const EMOJI_MAP = {
  '🚨': '[ERR]', '❌': '[X]', '⚠️': '[WARN]', '✅': '[OK]',
  '😊': ':)', '😴': 'zzz', '🎉': '!', '😐': ':|', '🐾': '*',
  '⭐': '*', '🍕': 'food', '🔥': 'hot', '⚡': 'fast', '🐢': 'slow',
};

class Logger {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this._init();
  }

  _init() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    this.log('--- SESSÃO INICIADA ---', 'SYSTEM');
  }

  _sanitizeForTerminal(text) {
    let sanitized = text;
    for (const [emoji, replacement] of Object.entries(EMOJI_MAP)) {
      sanitized = sanitized.split(emoji).join(replacement);
    }
    return sanitized.replace(/[^\x00-\x7F]/g, '');
  }

  log(message, level = 'INFO', source = 'Main') {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const timestamp = now.toISOString();
    
    const fileLog = `[${timestamp}] [${level}] [${source}] ${message}\n`;
    const terminalMsg = this._sanitizeForTerminal(message);
    const color = this._getLevelColor(level);
    const sourceColor = this._getSourceColor(source);
    
    console.log(`${COLORS.dim}[${time}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${sourceColor}${source}${COLORS.reset} ${terminalMsg}`);
    
    try {
      fs.appendFileSync(this.logFile, fileLog);
      const stats = fs.statSync(this.logFile);
      if (stats.size > 2 * 1024 * 1024) {
        fs.renameSync(this.logFile, this.logFile + '.old');
      }
    } catch (e) {}
  }

  _getLevelColor(level) {
    switch (level) {
      case 'ERROR': return COLORS.red + COLORS.bright;
      case 'WARN':  return COLORS.yellow;
      case 'DEBUG': return COLORS.magenta;
      case 'SYSTEM': return COLORS.green + COLORS.bright;
      default: return COLORS.cyan;
    }
  }

  _getSourceColor(source) {
    if (source.includes('Character')) return COLORS.yellow;
    if (source.includes('Behavior')) return COLORS.magenta;
    if (source.includes('Renderer')) return COLORS.blue;
    if (source.includes('TTS')) return COLORS.green;
    return COLORS.white;
  }

  error(err, context = 'Main') {
    if (!err) return;
    const stack = err.stack || 'No stack';
    const message = err.message || String(err);
    this.log(`[ERR] ${context}: ${message} | Stack: ${stack}`, 'ERROR', 'SYSTEM');
  }

  warn(msg, source = 'SYSTEM') {
    this.log(msg, 'WARN', source);
  }
}

module.exports = new Logger();
