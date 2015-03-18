'use strict';
/**
 * Created by Online By Design LLC.
 *
 * Worker takes a task and runs the task.
 */
var socketIo = require('socket.io-client');
var Log = require('./logger')();
//var npm = require("npm");

var config = require('../config.json');

var taskFolder = config.taskFolder || '../tasks/';

process.chdir(taskFolder);

var Worker = function () {
    this.isIdle = true;
 };

/**
 * Runs the given task with params passed in
 *
 * @param task - The task to perform
 */
Worker.prototype.run = function (task) {
    this.task = task;

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
        console.log(taskFolder);
        var taskScript = require('../' + taskFolder + '/' + task.module);
        taskScript.apply(this, task.params);
        this.isIdle = false;
    } catch (err) {
        this.error(err.message);
    }
};

/**
 * When the worker is done with the task.
 * It will send a done message as well as a request.
 */
Worker.prototype.done = function () {
    this.isIdle = true;
    socket.emit('task:done', JSON.stringify(this.task));
    socket.emit('task:request', 'workerName'); // TODO: Add a worker name
};

/**
 * When the worker has a task error
 */
Worker.prototype.error = function (err) {
    this.isIdle = true;
    socket.emit('task:error', err, JSON.stringify(this.task));
};

/**
 * Allows the worker to add a task if the worker decides one is need. Can be used to reduce the complexity of
 * dependencies in some situations.
 */
Worker.prototype.add = function (newTask) {
    socket.emit('task:add', newTask);
};

var worker = new Worker();

var socket = socketIo('http://' + config.masterHost + ':' + config.masterPort);

/**
 * When the connection is established/re-established ask master for a new task per idleWorker.
 */
socket.on('connect', function () {
    Log.info('connected to master');
    if (worker.isIdle) {
        socket.emit('task:request');
    }
});

/**
 * When the connection is disconnected we log it
 */
socket.on('disconnect', function () {
    Log.warn('disconnected from master');
});


/**
 * When the master sends a task to the worker, create a new worker for the task
 */
socket.on('task:send', function (taskJSON) {
    var taskParsed = JSON.parse(taskJSON);

    worker.run(taskParsed);
});