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

    /**
     * Runs the given task with params passed in
     *
     * @param task - The task to perform
     * @param params  The params to pass the task
     */
    this.run = function(task) {
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


            var taskScript = require('../tasks/' + task.module);
            taskScript.apply(this, task.params);
        } catch (e) {
            this.error(e);
        }
    };

    this.done();
};

util.inherits(Worker, ee); // Inherit the ee.prototype into Worker

Worker.prototype.done = function (msg) {
    console.log('task:done', msg);

    this.isIdle = true;
    clearTimeout(this.timer);
    this.emit('task:done');
    this.emit('task:request');
};

Worker.prototype.error = function (msg) {
    console.log('task:error', msg);

    this.emit('error', msg);
};

Worker.prototype.add = function (msg) {
    console.log('task:add', newTask);

    // TODO: Figure this out
};

module.exports = Worker;
