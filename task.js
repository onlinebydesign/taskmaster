/**
 * Created by James on 2/10/2015.
 */

var util = require("util");
var ee = require("events").EventEmitter;

var Task = function (task, params) {
    ee.call(this);

    this.done = function (msg) {
        this.emit('done', msg);
    };

    this.error = function (msg) {
        this.emit('error', msg);
    };

    this.task = task;
    this.params = params;
};
util.inherits(Task, ee);

module.exports = Task;