'use strict';
/**
 * Created by Online By Design LLC.
 *
 * Worker takes a task and runs the task.
 */
var socketIo = require('socket.io-client');
var config = require('../config.json');
var child = require('child_process');

var Log = require('../logger')(config.logger);

var taskFolder = config.taskFolder || 'tasks';

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

    this.taskProcess = child.fork('lib/task.js');

    this.taskProcess.send({command: 'run', task: task});

    var worker = this;
    this.taskProcess.on('message', function(message) {
        switch (message.command) {
            case 'done':
                worker.done();
                break;
            case 'error':
                worker.error(message.err);
                break;
            case 'add':
                worker.add(message.task);
                break;
            default:
                console.log(message);
        }
    })
};

/**
 * When the worker is done with the task.
 * It will send a done message as well as a request.
 */
Worker.prototype.done = function () {
    this.taskProcess.kill();
    this.isIdle = true;
    socket.emit('task:done', JSON.stringify(this.task));
    socket.emit('task:request', 'workerName'); // TODO: Add a worker name
};

/**
 * When the worker has a task error
 */
Worker.prototype.error = function (err) {
    this.taskProcess.kill();
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

/**
 * When the master tells us to cancel a task we need to pass on the cancel command
 */
socket.on('task:cancel', function (taskJSON) {
    worker.taskProcess.kill();
    worker.isIdle = true;
});
