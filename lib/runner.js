/**
 * Created by James on 2/8/2015.
 *
 * The runner requests for tasks from the master and starts a new worker for each task
 */

var Worker = require('./worker');
var socketIo = require('socket.io-client');
var npm = require("npm");

var busy = false;
var connected = false;


/**
 * Runner is initialized here
 *
 * @param host - The host to connect to master
 * @param port - The port to connect to master
 * @param timeout - How long to allow a task to run
 */
module.exports = function (host, port, timeout) {
    var socket = socketIo('http://' + host + ':' + port);

    socket.on('connect', function () {
        connected = true;
        console.log('connected to master');
        // If not busy then request a task
        if (connected && !busy) {
            socket.emit('task:request', '');
        }
    });

    /**
     * When the master sends a task to the runner, create a new worker for the task
     */
    socket.on('task:send', function (taskJSON) {
        console.log('Received a task from master', taskJSON);
        var taskParsed = JSON.parse(taskJSON);

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

        var worker = new Worker(taskParsed.task, taskParsed.params, {"timeout": timeout});

        /**
         * When the worker is done with the task
         */
        worker.on('done', function () {
            console.log('task:done', taskJSON);
            socket.emit('task:done', taskJSON);
        });

        /**
         * When the worker has a task error
         */
        worker.on('error', function (err) {
            console.log('task:error', err);
            socket.emit('task:error', err);

            // Destroy the task (and make sure all event listeners are gone so we don't have a memory leak)
            //task.destroy();
        });

        /**
         * TODO: Decide when this should be run, before after, or parallel to the done event.
         * Allows the worker to add a task if the worker decides one is need. Can be used to reduce the complexity of
         * dependencies in some situations.
         */
        worker.on('task:add', function (newTask) {
            console.log('task:add', newTask);
            socket.emit('task:add', newTask);

            // Destroy the task (and make sure all event listeners are gone so we don't have a memory leak)
            //task.destroy();
        });
    });
};