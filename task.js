/**
 * Created by James on 2/10/2015.
 */

var util = require("util");
var ee = require("events").EventEmitter;

exports = function Task(task, params) {
    ee.call(this);

    this.done = function (msg) {
        this.emit('done', msg);
    };

    this.error = function (msg) {
        this.emit('error', msg);
    };
};
util.inherits(Task, ee);
