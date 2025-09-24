// 简单的日志工具
export const createLogger = (name: string) => {
  const isDev = import.meta.env.DEV;
  
  return {
    info: (message: string, ...args: any[]) => {
      if (isDev) {
        console.log(`[${name}] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      if (isDev) {
        console.warn(`[${name}] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${name}] ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      if (isDev) {
        console.debug(`[${name}] ${message}`, ...args);
      }
    },
  };
};
