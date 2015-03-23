'use strict';
/**
 * Created by Online By Design LLC.
 *
 */

var ee = require("events").EventEmitter;
var util = require("util");

var Feeder = function (options) {
    ee.call(this); // Initialize the EventEmitter

    options = options || {};
    options.master = options.master || 'http://localhost:3000';

    this.socket = require('socket.io-client')(options.master);

    /**
     * When a runner wants to add tasks to the list
     */
    this.socket.on('task:added', function (tasks) {
        console.log('Task added', tasks);
        this.emit('task:added', tasks);
    }.bind(this));

    /**
     * When a runner worker has a task error
     */
    this.socket.on('task:error', function (msg) {
        console.log('Master error:', msg);
        this.emit('task:error', msg);
    }.bind(this));

    /**
     * When the connection is established/re-established ask master for a new task per idleWorker.
     */
    this.socket.on('connect', function () {
        console.log('Connected to Master');
        this.emit('task:connect');
    }.bind(this));

    /**
     * When the connection is disconnected we log it
     */
    this.socket.on('disconnect', function () {
        console.log('Disconnected from Master');
    }.bind(this));

};

util.inherits(Feeder, ee); // Inherit the ee.prototype into this

/**
 * TODO: Add some validation
 * Add a task or tasks.
 */
Feeder.prototype.add = function (newTasks) {
    console.log('task:add', newTasks);
    if (this.socket.connected) {
        this.socket.emit('task:add', newTasks);
    } else {
        // If we aren't connected yet then wait until we are connected then add the task.
        this.socket.once('connect', function () {
            this.emit('task:add', newTasks);
        })
    }
};

module.exports = Feeder;