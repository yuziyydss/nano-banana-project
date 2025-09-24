import winston from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// 自定义格式
const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  return log;
});

// 创建 logger
export const createLogger = (label) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      winston.format.label({ label }),
      process.env.NODE_ENV === 'production' ? json() : customFormat
    ),
    defaultMeta: { service: 'nanobanana-server' },
    transports: [
      new winston.transports.Console({
        format: combine(
          colorize(),
          customFormat
        ),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: json(),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: json(),
      }),
    ],
  });
};

export default createLogger('app');
