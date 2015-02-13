/**
 * Created by James on 2/10/2015.
 *
 * Worker takes a task and runs the task.
 */

var util = require("util");
var ee = require("events").EventEmitter;

var Worker = function (task, params, options) {
    var timeout = options.timeout || 300000; // 5 minutes is the default timeout time

    ee.call(this); // Initialize the EventEmitter

    // timer will trigger an error if timeout expires before task emits 'done'.
    this.timer = setTimeout((function () {
        this.error('Worker timed out');
    }).bind(this), timeout);


    // Run the task
    try {
        var taskScript = require('../tasks/' + task);
        taskScript.apply(this, params);
    } catch (e) {
        this.error(e);
    }
};
util.inherits(Worker, ee); // Inherit the ee.prototype into Worker

Worker.prototype.done = function (msg) {
    clearTimeout(this.timer);
    this.emit('done', msg);
};

Worker.prototype.error = function (msg) {
    this.emit('error', msg);
};

Worker.prototype.add = function (msg) {
    // TODO: Figure this out
};

module.exports = Worker;
