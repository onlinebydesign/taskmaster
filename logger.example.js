'use strict';
var bunyan = require('bunyan');
var MongoLogStream = require('bunyan-mongodb-stream');
var EmailStream = require('bunyan-emailstream').EmailStream;
var BunyanSlack = require('bunyan-slack');

module.exports = bunyan.createLogger({
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
            webhook_url: '',
            channel: '',
            username: '',
            icon_emoji: '',
            customFormatter: function (record, levelName) {
                var fields = [];
                for (var field in record.err) {
                    fields.push({title: field, value: '```' + record.err[field] + '```', short: false});
                }
                return {
                    attachments: [{
                        fallback: record.msg,
                        pretext: '',
                        color: (levelName == 'error' || levelName == 'fatal') ? 'danger' : (levelName == 'warn') ? 'warning' : '#aaa',
                        author_name: record.name + '@' + record.hostname,
                        author_icon: '',
                        title: '[' + levelName.toUpperCase() + '] ' + record.msg,
                        text: (levelName == 'error' || levelName == 'fatal') ? 'Attn: <!channel>' : '',
                        fields: fields,
                        'mrkdwn_in': ["pretext", "text", "fields"]
                    }]
                }
            }
        })
    }, {
        type: 'raw',
        level: 'error',
        stream: new EmailStream({
            from: '',
            to: '',
            subject: 'Task Master Error',
            message: 'Something is wrong'
        }, {
            type: 'SMTP',
            host: "smtp.gmail.com",
            secureConnection: true,
            port: 465,
            auth: {
                user: '',
                pass: ''
            }
        })
    }]
});
