/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ayios. All rights reserved.
 *  All code created by Ayios within this repository is licensed under the MIT License. Other
 *  code not created by Ayios is under their respective license, which should have an
 *  indication of whatever copyright the file is subject to.
 *--------------------------------------------------------------------------------------------*/
import { DateTime } from 'luxon';
import { randomUUID } from 'crypto';
import chalk, { Chalk } from 'chalk';

// This needs work still

export interface LoggerOptions {
    cluster?: number;
    /** Uses Error by default (in production); Debug in development */
    level?: number;
    /** Used to initially, on logger creation, calculate the prefix shown */
    showPrefix?: string | (() => string);
    /** Uses `id` if `name` is blank */
    component?: { id: string; name?: string };
    colorized?: { [key: string]: Chalk };
    timezone?: boolean;
    contextColors?: { [key: string]: Chalk };
    defaultComponentColor?: Chalk;
}

export enum LogLevel {
    Error   = 0,
    Warning = 1,
    Info    = 2,
    Debug   = 3
}

const LOG_COLORS: Record<string, Chalk> = {
    info: chalk.green,
    warn: chalk.yellowBright,
    debug: chalk.blueBright,
    error: chalk.redBright
}

const loggers = new Map<string, Logger>();
const loggersComponentIdMap = new Map<string, string>();

export class Logger {
    public readonly id: string;
    public options: LoggerOptions = {
        level: LogLevel.Info,
        defaultComponentColor: chalk.magenta,
        contextColors: {}
    };
    public readonly prefix!: string;
    constructor(options?: LoggerOptions) {
        this.id = randomUUID();
        this.setOptions(options);
    }
    public setGlobalLevel(level: LogLevel) {
        loggers.forEach(l => {
            l.setOptions({ level: level });
        });
        return this;
    }
    public getById(id: string) {
        return loggers.get(id);
    }
    public getByComponent(id: string) {
        const loggerId = loggersComponentIdMap.get(id);
        if (!loggerId) return undefined;
        return this.getById(loggerId);
    }
    public setOptions(options?: LoggerOptions) {
        Object.assign(this.options, options);
        const doSetComponent = options && 'module' in options
            && 'id' in options.component! && 'name' in options.component!;
        if (doSetComponent) {
            options.component!.name = options.component!.id;
        }
        if (options?.showPrefix) {
            if (typeof options.showPrefix === 'string') {
                Object.defineProperty(this, 'prefix', {
                    writable: true,
                    value: options.showPrefix
                });
            } else {
                Object.defineProperty(this, 'prefix', {
                    writable: true,
                    value: options.showPrefix()
                })
            }
        }
        loggers.set(this.id, this);
        const compId = this.options.component?.id;
        if (compId) loggersComponentIdMap.set(compId, this.id);
        return this;
    }
    /** Fork a new logger instance */
    public fork(options: LoggerOptions) {
        const logger = new Logger(Object.assign({}, this.options, options));
        loggers.set(logger.id, logger);
        return logger;
    }
    private colorizeSender(colStr: string, rawStr: string) {
        if (this.options.colorized && colStr in this.options.colorized) {
            return this.options.colorized[colStr](rawStr);
        }
        return chalk.blue(rawStr);
    }
    private formatMessage(level: 'info' | 'warn' | 'debug' | 'error', message: string, context?: string): string {
        const timeFormat = DateTime.now()
            .setZone('America/Los_Angeles')
            .toFormat(`[yyyy-LL-dd hh:mm:ss a${this.options.timezone ? ' ZZZZ' : ''}]`);
        let logMessage = (this.prefix ? `${this.colorizeSender(this.prefix, `[${this.prefix}]`)} ` : '') + `${timeFormat}`;

        logMessage += ` ${LOG_COLORS[level](`[${level.toUpperCase()}]`)}`;
        const contextColors: Record<string, Chalk> = {
            System: chalk.magenta,
            Mongo: chalk.green,
            MongoDB: chalk.green,
            Database: chalk.green,
            Redis: chalk.red
        }
        Object.assign(contextColors, this.options.contextColors);
        if (context) {
            if (context in contextColors) {
                logMessage += ` [${contextColors[context](context)}]`;
            } else {
                logMessage += ` [${context}]`;
            }
        }
        if (this.options.component) {
            logMessage += ` ${this.options.defaultComponentColor!(`[${this.options.component!.name}]`)}`;
        }
        return logMessage + ` ${message}`;
    }
    private logMessage(level: 'info' | 'warn' | 'debug' | 'error', message: string, context?: string) {
        const levels: Record<typeof level, any> = {
            error: [ 0, console.error ],
            warn:  [ 1, console.warn  ],
            info:  [ 2, console.info  ],
            debug: [ 3, console.debug ],
        }
        const [ priority, execute ] = levels[level];
        if (priority <= this.options.level!) execute(this.formatMessage(level, message, context));
        return this;
    }
    public info(message: string, context?: string) {
        return this.logMessage('info', message, context);
    }
    public warn(message: string, context?: string) {
        return this.logMessage('warn', message, context);
    }
    public debug(message: string, context?: string) {
        return this.logMessage('debug', message, context);
    }
    public error(message: string, context?: string) {
        return this.logMessage('error', message, context);
    }
}

export default new Logger();