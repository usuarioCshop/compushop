const isDev = process.env.NODE_ENV !== 'production';

function log(level, message, meta = {}) {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else if (isDev) {
    console.log(JSON.stringify(entry));
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
