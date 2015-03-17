'use strict';
/**
 * Created by Online By Design LLC.
 *
 */

var ee = require("events").EventEmitter;

module.exports = function (options) {
    "use strict";
    options = options || {};
    options.master = options.master || 'http://localhost:3000';

    var socket = require('socket.io-client')(options.master);

    /**
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
    });


    return ee;
};
