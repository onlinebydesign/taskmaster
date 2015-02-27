/**
 * Created by James on 2/8/2015.
 *
 * The runner requests for tasks from the master and starts a new worker for each task
 */

var Worker = require('./worker');
var socketIo = require('socket.io-client');
var _ = require('lodash');
var Log = require('./logger');

var workers = [];

/**
 * Runner is initialized here
 *
 * @param host - The host to connect to master
 * @param port - The port to connect to master
 * @param options - Options for the runner.  Includes timeout, maxWorkers
 */
module.exports = function (options) {
    _.defaults(options, {
        runnerTimeout: 300000,
        runnerMaxWorkers: 1
    });

    // Create maxWorkers number of workers
    for (var i = 0; i < options.runnerMaxWorkers; i++) {
        var worker = new Worker({"timeout": options.runnerTimeout});

        /**
         * When the worker is done with the task
         */
        worker.on('task:done', function () {
            socket.emit('task:done', JSON.stringify(this.task));
        });

        /**
         * When a worker wants a task we let the master know
         */
        worker.on('task:request', function () {
            socket.emit('task:request', options.runnerName);
        });

        /**
         * When the worker has a task error
         */
        worker.on('task:error', function (err, task) {
            socket.emit('task:error', err, JSON.stringify(task));
            // TODO: Write to a log and/or send an email notification
        });

        /**
         * Allows the worker to add a task if the worker decides one is need. Can be used to reduce the complexity of
         * dependencies in some situations.
         */
        worker.on('task:add', function (newTask) {
            socket.emit('task:add', newTask);
        });

        workers.push(worker);
    }

    var socket = socketIo('http://' + config.masterHost + ':' + config.masterPort);

    /**
     * When the connection is established/re-established ask master for a new task per idleWorker.
     */
    socket.on('connect', function () {
        Log.info('connected to master');

        // For each idle worker
        var idleWorkerCount = findIdleWorkers().length;
        for (var i = 0; i < idleWorkerCount; i++) {
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
     * When the master sends a task to the runner, create a new worker for the task
     */
    socket.on('task:send', function (taskJSON) {
        var taskParsed = JSON.parse(taskJSON);

        // Find an available worker to run the task
        var worker = findIdleWorker();
        if (_.isUndefined(worker)) {
            // This should not happen because we program perfectly
            Log.error('No idle workers were found when there should have been because a task was requested by a worker.');
        } else {
            worker.run(taskParsed);
        }
    });
};


/**
 * Returns an idle worker
 */
function findIdleWorker() {
    return _.find(workers, 'isIdle');
}


/**
 * Returns all of the idle workers
 */
function findIdleWorkers() {
    return _.filter(workers, 'isIdle');
}