/**
 * Created by James on 2/8/2015.
 */

var options = {};
options.master = process.argv[2] || 'http://192.168.1.10:3000';
options.timeout = process.argv[3] || 300000; // 5 minutes is the default timeout time

var socket = require('socket.io-client')(options.master);
var Task = require('./task');

var busy = false;
var connected = false;

socket.on('connect', function () {
    connected = true;
    console.log('connected to master');
    // If not busy then request a task
    if (connected && !busy) {
        socket.emit('task request', '');
    }
});

/**
 * When the master sends a task to the worker
 */
socket.on('task send', function (taskJSON) {
    console.log('Received a task from master', taskJSON);
    var taskParsed = JSON.parse(taskJSON);
    var task = new Task(taskParsed.task, taskParsed.params);

    // timer will trigger an error if options.timeout expires before task emits 'done'.
    var timer = setTimeout(function () {
        task.error('Task timed out');
    }, options.timeout);

    // Setup the task communication via an event emitter worker
    // TODO: can this be removed
    //var eventEmitter = new events.EventEmitter();

    /**
     * When the worker is done with the task
     */
    task.on('done', function () {
        clearTimeout(timer);
        console.log('task done', taskJSON);
        socket.emit('task done', taskJSON);
    });

    /**
     * When the worker has an error
     */
    task.on('error', function (err) {
        console.log('task error', err);
        socket.emit('task error', err);
    });

    // Run the task
    var taskScript = require('./' + task.task)(task);

});
