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
    colorized?: { [key: string]: Chalk }
}

export enum LogLevel {
    Error   = 0,
    Warning = 1,
    Info    = 2,
    Debug   = 3
}

const loggers = new Map<string, Logger>();
const loggersComponentIdMap = new Map<string, string>();

export class Logger {
    public readonly id: string;
    public options: LoggerOptions = { level: LogLevel.Info };
    public readonly prefix!: string;
    constructor(options?: LoggerOptions) {
        this.id = randomUUID();
        this.setOptions(options);
    }
    public setGlobalLevel(level: LogLevel) {
        loggers.forEach(l => {
            l.setOptions({ level: level });
        });
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
        if (options && Object.hasOwn(options, 'module') && Object.hasOwn(options.component!, 'id') && Object.hasOwn(options.component!, 'name')) {
            options.component!.name = options.component!.id;
        }
        if (options?.showPrefix) {
            if (typeof options.showPrefix === 'string') {
                Object.defineProperty(this, 'prefix', { writable: false, value: options.showPrefix });
            } else {
                Object.defineProperty(this, 'prefix', {
                    writable: false,
                    value: options.showPrefix()
                })
            }
        }
        loggers.set(this.id, this);
        const compId = this.options.component?.id;
        if (compId) loggersComponentIdMap.set(compId, this.id);
    }
    /** Fork a new logger instance */
    public fork(options: LoggerOptions) {
        const logger = new Logger(Object.assign({}, this.options, options));
        loggers.set(logger.id, logger);
        return logger;
    }
    private colorizeSender(string: string) {
        if (this.options.colorized && Object.hasOwn(this.options.colorized, string)) {
            return this.options.colorized[string]();
        }
        return chalk.blueBright(string);
    }
    private formatMessage(level: 'info' | 'warn' | 'debug' | 'error', message: string, context?: string): string {
        const timeFormat = DateTime.now().setZone('America/Los_Angeles').toFormat(`[yyyy-LL-dd hh:mm:ss a]`);
        // const prefix = this.options.cluster !== undefined ? `[C${this.options.cluster}]` : `[ClusterManager]`;
        let logMessage = `${this.colorizeSender(`${this.prefix}`)} ${timeFormat}`;
        
        const logColors: Record<typeof level, Chalk> = {
            info: chalk.green,
            warn: chalk.yellowBright,
            debug: chalk.blueBright,
            error: chalk.redBright
        }
        logMessage += ` ${logColors[level](`[${level.toUpperCase()}]`)}`;
        const contextColors: Record<string, Chalk> = {
            System: chalk.magenta,
            Mongo: chalk.green,
            MongoDB: chalk.green,
            Redis: chalk.red
        }
        if (context && context in contextColors) logMessage += ` [${contextColors[context](context)}]`;
        if (this.options.component) logMessage += ` ${chalk.magenta(`[${this.options.component!.name}]`)}`;
        return logMessage + ` ${message}`;
    }
    public info(message: string, context?: string) {
        this.logMessage('info', message, context);
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
    }
    public warn(message: string, context?: string) {
        this.logMessage('warn', message, context);
    }
    public debug(message: string, context?: string) {
        this.logMessage('debug', message, context);
    }
    public error(message: string, context?: string) {
        this.logMessage('error', message, context);
    }
}

export default new Logger();