/**
 * Created by James on 2/8/2015.
 */

var options = {};
options.master = process.argv[2] || 'http://192.168.0.147:3000';
options.timeout = process.argv[3] || 300000; // 5 minutes is the default timeout time

var socket = require('socket.io-client')(options.master);
var Worker = require('./worker');
var npm = require("npm");

var busy = false;
var connected = false;

socket.on('connect', function () {
    connected = true;
    console.log('connected to master');
    // If not busy then request a task
    if (connected && !busy) {
        socket.emit('task:request', '');
    }
});

/**
 * When the master sends a task to the client create a new worker for the task
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


    var worker = new Worker(taskParsed.task, taskParsed.params, {"timeout": options.timeout});

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

    worker.on('task:add', function () {
        console.log('task:error', err);
        socket.emit('task:add', err);

        // Destroy the task (and make sure all event listeners are gone so we don't have a memory leak)
        //task.destroy();
    });
});
