/**
 * Created by James on 2/10/2015.
 *
 * Worker takes a task and runs the task.
 */

var util = require("util");
var ee = require("events").EventEmitter;
var npm = require("npm");

var Worker = function (options) {
    var timeout = options.timeout || 300000; // 5 minutes is the default timeout time

    ee.call(this); // Initialize the EventEmitter

    // timer will trigger an error if timeout expires before task emits 'done'.
    this.timer = setTimeout((function () {
        this.error('Worker timed out');
    }).bind(this), timeout);

    this.isIdle = true;
    this.emit('task:request');
};

util.inherits(Worker, ee); // Inherit the ee.prototype into Worker

/**
 * Runs the given task with params passed in
 *
 * @param task - The task to perform
 * @param params  The params to pass the task
 */
Worker.prototype.run = function (task) {
    this.task = task;

    // Run the task
    try {
        this.isIdle = false;

        // TODO: Make this work with a private npm repo
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

        // TODO: Make this multi-threaded using child processes
        var taskScript = require('../tasks/' + task.module);
        taskScript.apply(this, task.params);
    } catch (err) {
        this.error(err, task);
    }
};

Worker.prototype.done = function () {
    console.log('task:done', this.task.module, this.task.params);

    this.isIdle = true;
    clearTimeout(this.timer);
    this.emit('task:done');
    this.emit('task:request');
};

Worker.prototype.error = function (err, task) {
    console.log('task:error', err, task);

    this.emit('error', err, task);
};

Worker.prototype.add = function (newTask) {
    console.log('task:add', newTask);

    // TODO: Figure this out
};

module.exports = Worker;
