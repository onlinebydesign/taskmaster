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
            stream: process.stdout
        }, {
            level: 'info',
            type: 'rotating-file',
            path: './logs/taskmaster-info.log',
            period: '1d',
            count: 7
        }, {
            level: 'warn',
            stream: MongoLogStream({model: require('models/logs')})
        }, {
            type: 'raw',
            level: 'warn',
            stream: new BunyanSlack({
                webhook_url: '',
                channel: '',
                username: ''
            })
        }, {
            type: 'raw',
            level: 'error',
            stream: new EmailStream({
                from: '',
                to: '',
                subject: 'test email logging',
                message: 'test'
            }, {
                type: 'SMTP',
                host: "smtp.gmail.com",
                port: 587,
                auth: {
                    user: '',
                    pass: ''
                }
            })
        }]
    });
};
