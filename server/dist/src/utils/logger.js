import { isProduction } from '../config/env.js';
function write(level, message, context) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...context,
    };
    const line = isProduction ? JSON.stringify(payload) : `${payload.ts} [${level}] ${message}${context ? ` ${JSON.stringify(context)}` : ''}`;
    if (level === 'error')
        console.error(line);
    else if (level === 'warn')
        console.warn(line);
    else
        console.log(line);
}
export const logger = {
    debug(message, context) {
        if (!isProduction)
            write('debug', message, context);
    },
    info(message, context) {
        write('info', message, context);
    },
    warn(message, context) {
        write('warn', message, context);
    },
    error(message, context) {
        write('error', message, context);
    },
};
