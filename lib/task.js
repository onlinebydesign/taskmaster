'use strict';
/**
 * Created by Online By Design LLC.
 *
 * Worker takes a task and runs the task.
 */
var config = require('../config.json');

var taskFolder = config.runner.taskFolder;
var EventEmitter = require('events').EventEmitter;
var ee = new EventEmitter();
//var npm = require("npm");

var task;

process.chdir(taskFolder);

var sendError = function (err) {
    process.send({command: 'error', err: err});
};

process.on('message', function(message) {
    if (message.command === 'run') {
        task = message.task;
        // Run the task
        try {
            // TODO: Make this work with a private npm repo
            //    npm.load({loaded: false}, function (err) {
            //        if (err) return console.error(err);
            //
            //        npm.commands.install([taskParsed.task], function (err, data) {
            //            if (err) return console.error(err);
            //
            //            console.log('npm install success', data);
            //        });
            //        npm.registry.log.on("log", function (message) {
            //            console.log(message);
            //        })
            //    });
            var taskScript = require('../' + taskFolder + '/' + task.module);
            taskScript.apply(ee, task.params);
        } catch (err) {
            sendError(err.message);
        }
    }
});

/**
 * When the task is done processing.
 */
ee.on('done', function () {
    process.send({command: 'done'});
});

/**
 * When the task has a task error
 */
ee.on('error', function(err) {
    sendError(err);
});

/**
 * Allows the task to add a task if it needs one.
 */
ee.on('add', function(newTask) {
    process.send({command: 'add', task: newTask});
});
