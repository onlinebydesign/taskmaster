'use strict';
var bunyan = require('bunyan');
var MongoLogStream = require('bunyan-mongodb-stream');
var EmailStream = require('bunyan-emailstream').EmailStream;
var BunyanSlack = require('bunyan-slack');

module.exports = function (options) {
    return bunyan.createLogger({
        name: 'taskmaster',
        streams: [{
            level: 'info',
            stream: process.stdout // TODO: Add everything to a log file locally in case of internet/network issues
        }, {
            level: 'warn',
            stream: MongoLogStream({model: require('../models/logs')})
        }, {
            type: 'raw',
            level: 'warn',
            stream: new BunyanSlack({
                webhook_url: 'https://hooks.slack.com/services/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',
                channel: '#ezr-admin',
                username: 'EZR Taskmaster'
            })
        }, {
            type: 'raw',
            level: 'error',
            stream: new EmailStream({
                from: 'test@dev1.org',
                to: 'admin@ezrstocks.com',
                subject: 'test email logging',
                message: 'test'
            }, {
                type: 'SMTP',
                host: "smtp.gmail.com",
                port: 587,
                auth: {
                    user: 'test@dev1.org',
                    pass: 'hT,7!\\/Z`0Sgh76luUgc'
                }
            })
        }]
    });
};
