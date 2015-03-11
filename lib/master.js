"use strict";
/**
 * Created by Online By Design LLC.
 *
 * The master is in charge of keeping track of task requests from the runners and assigning tasks as they become available.
 * The master also manages adding and updating tasks in the mongodb
 */

/**
 * Master is initialized here
 *
 * @param config - Configuration options
 */
module.exports = function (config) {
    //var express = require('express');
    //var connect = require('connect');
    var io = require('socket.io')(config.port || 3000);
    var mongoose = require('mongoose');
    var _ = require('lodash');
    var async = require('async');
    var moment = require('moment');
    var Log = require('./logger')();

    // Load models
    var Task = require('../models/tasks');

    // Module configuration
    mongoose.connect(config.taskDb || 'mongodb://localhost/taskrunner');

    Log.info("Master started");

    // Variables
    var tasks = [];
    var tasksLoaded = false;

    // Connect to database and get the list of tasks
    var db = mongoose.connection;
    db.on('error', function (err) {Log.error({err:err}, 'Could not connect to mongodb')}); // TODO: test this out
    db.once('open', function () {
        Task.find(function (err, docs) {
            if (err) return Log.error({err:err}, 'Error when finding tasks'); // TODO: test this out

            tasks = docs;
            tasksLoaded = true;
        });
    });


    /**
     * When a runner establishes/reestablishes connection
     */
    io.on('connection', function (socket) {
        Log.info('Runner connected.  (', findRunners().length, ')');


        /**
         * When the runner disconnects
         */
        socket.on('disconnect', function () {
            Log.warn('Runner disconnected.  (', findRunners().length, ')');
        });


        /**
         * When the socket has an error
         */
        socket.on('error', function (err) {
            Log.error({err:err}, "A socket had an error");
        });


        /**
         * When the runner requests a task
         */
        socket.on('task:request', function () {
            socket._idleWorkers = true;

            assignTasks();
        });


        /**
         * When a runner worker finishes a task
         */
        socket.on('task:done', function (taskJSON) {
            Log.info('Task completed'); // TODO: Indicate module and runner name

            // Update the task and save it to the database.
            var taskParsed = JSON.parse(taskJSON);
            var task = _.find(tasks, "_id", mongoose.Types.ObjectId(taskParsed._id));
            task.assigned.completed = moment().unix();
            task.save(function (err) {
                if (err) return Log.error({err:err}, 'Error updating task status as complete to mongodb');

                assignTasks();
            });
        });
        /**
         * When a runner worker has a task error
         */
        socket.on('task:error', function (err, taskJSON) {
            Log.error({err:err}, 'Task error');

            // Delete assigned state so task can be reassigned
            var taskParsed = JSON.parse(taskJSON);
            var task = _.find(tasks, "_id", mongoose.Types.ObjectId(taskParsed._id));
            task.assigned = undefined;
            task.save(function (err) {
                if (err) return Log.error({err:err}, 'Error un-assigning task assignment to mongodb');
            });
        });


        /**
         * When a runner wants to add tasks to the list
         */
        socket.on('task:add', function (newTasks) {

            function addNewTask(newTask, done) {
                var task = new Task(newTask);
                task.save(function (err) {
                    if (err) done(err);

                    tasks.push(task);
                    done()
                })
            }

            async.each(newTasks, addNewTask, function (err) {
                if (err) return Log.error({err:err}, 'Error while adding tasks');

                Log.info('Task(s) added'); // TODO: Indicate what tasks were added to the list
                assignTasks();
            });

        });


    });
    /***********************************************************************************************************************
     * Helper functions
     **********************************************************************************************************************/

    /**
     * Assigns the next available task to the next available worker while there is still an available task and worker.
     * This is done synchronously since multiple instances of it may be running at a time.
     */
    function assignTasks() {
        var task;

        while((task = findNextTask())) {
            var socket = findIdleRunner();
            if (socket) {
                saveAssignedTask(task, socket);
            }
        }
    }

    /**
     * Save a newly assigned task to the database then send the task to the runner.
     *
     * @param task
     * @param socket
     */
    function saveAssignedTask(task, socket) {
        // Mark the task as assigned
        task.assigned.who = 'runnername'; // TODO: Pull the runner name from the socket
        task.assigned.when = moment().unix();

        task.save(function (err) {
            if (err) return Log.error({err:err}, 'Error saving task to mongodb');

            socket.emit('task:send', JSON.stringify(task));
            Log.info('Task sent'); // TODO: Indicate module and runner name
        });
    }

    // TODO: Handle crashes where the worker looses the assigned task so we need to re-assign it.
    /**
     * Finds the next available task
     */
    function findNextTask() {
        // Sort the tasks by priority
         tasks.sort(function(taskA, taskB) {
            if (taskA.priority < taskB.priority) {
                return -1;
            }

            if (taskA.priority > taskB.priority) {
                return 1;
            }

            return 0;
        });

        return _.find(tasks, function (task) {
            if (task.get('assigned.when')) {
                return false;
            }

            var dependencies = task.dependencies;
            for (var i = 0; i < dependencies.length; i++) {
                var dependency = dependencies[i];

                var metDependency = _.find(tasks, function(task) {
                    return task.get('assigned.completed') && this.module === task.module && _.isEqual(this.params, task.params)
                }, dependency);

                if (!metDependency) {
                    return false; // This happens when there is a dependency which has not been met.
                }
            }

            return true;
        });
    }

    /**
     * Finds a runner with an idle worker and decreases the idle worker count before returning the socket
     */
    function findIdleRunner() {
        // Get the first runner with idle workers.
        var socket = _.find(findRunners(), function(runner) {
            return runner._idleWorkers;
        });

        // If a runner with an idle worker is found decrement the idleWorkers count and return it.
        if (socket) {
            socket._idleWorkers = false;
            return socket;
        }

        return null;
    }


    /**
     * Searches for runners connected to the socket.io master (Copied from some where online)
     *
     * @param {String} [namespace] - Filter workers by namespace
     * @param {String} [room] - Filter runners by room
     * @returns {Array} - List of runners
     */
    function findRunners(namespace, room) {
        var workers = [], ns = io.of(namespace || "/");

        if (ns) {
            for (var id in ns.connected) {
                if (room) {
                    var index = ns.connected[id].rooms.indexOf(room);
                    if (index !== -1) {
                        workers.push(ns.connected[id]);
                    }
                } else {
                    workers.push(ns.connected[id]);
                }
            }
        }
        return workers;
    }
}
;
