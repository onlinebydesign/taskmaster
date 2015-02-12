/**
 * Created by Jed on 2/12/2015.
 *
 * TODO: find a good name for this script.
 */

var ee = require("events").EventEmitter;

module.exports = function (options) {
    "use strict";
    options.master = process.master || 'http://localhost:3000';

    var socket = require('socket.io-client')(options.master);

    /**
     * TODO: The event name might need to be changed to something like acknowledgement.
     * When a runner wants to add tasks to the list
     */
    socket.on('task:added', function (tasks) {
        console.log('Task added', tasks);
        ee.emit('task:added', tasks);
    });

    /**
     * When a runner worker has a task error
     */
    socket.on('task:error', function (msg) {
        console.log('Worker error', msg);
        ee.emit('task:error', msg);
    });

    /**
     * TODO: Add some validation
     * Add a task
     */
    ee.on('task:add', function (newTasks) {
        console.log('task:add', newTasks);
        socket.emit('task:add', newTasks);

        // Destroy the task (and make sure all event listeners are gone so we don't have a memory leak)
        //task.destroy();
    });


    return ee;
};
