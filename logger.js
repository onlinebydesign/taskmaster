'use strict';
var bunyan = require('bunyan');
var MongoLogStream = require('bunyan-mongodb-stream');
var EmailStream = require('bunyan-emailstream').EmailStream;
var BunyanSlack = require('bunyan-slack');

module.exports = function () {
    return bunyan.createLogger({
        name: 'taskmaster',
        streams: [{
            level: 'info',
            stream: process.stdout
        }, {
            level: 'info',
            type: 'rotating-file',
            path: './logs/taskmaster-info.log',
            period: '1d',
            count: 90
        }, {
            level: 'warn',
            stream: MongoLogStream({model: require('./models/logs')})
        }, {
            type: 'raw',
            level: 'warn',
            stream: new BunyanSlack({
                webhook_url: 'https://hooks.slack.com/services/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',
                channel: '#ezr-admin',
                username: 'Task Master'
            })
        }, {
            type: 'raw',
            level: 'error',
            stream: new EmailStream({
                from: 'test@dev1.org',
                to: 'admin@ezrstocks.com',
                subject: 'Task Master Error',
                message: 'Something is wrong'
            }, {
                type: 'SMTP',
                host: "smtp.gmail.com",
                secureConnection: true,
                port: 465,
                auth: {
                    user: 'test@dev1.org',
                    pass: 'hT,7!\\/Z`0Sgh76luUgc'
                }
            })
        }]
    });
};
