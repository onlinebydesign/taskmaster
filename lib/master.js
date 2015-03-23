'use strict';
/**
 * Created by Online By Design LLC.
 *
 * The master is in charge of keeping track of task requests from the workers and assigning tasks as they become available.
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
    var Log = require('../logger')(config.logger);

    // Load models
    var Task = require('../models/tasks');

    // Module configuration
    mongoose.connect(config.taskDb || 'mongodb://localhost/taskrunner');

    Log.info("Master started");

    // Variables
    var tasks = [];
    var tasksLoaded = false;
    var timeout = config.workerTimeout || 300000; // 5 minutes is the default timeout time for master

    // Connect to database and get the list of tasks
    var db = mongoose.connection;
    db.on('error', function (err) {Log.error({err:err}, 'Could not connect to mongodb')}); // TODO: test this out
    db.once('open', function () {
        Task.find(function (err, docs) {
            if (err) return Log.error({err:err}, 'Error when finding tasks'); // TODO: test this out

            tasks = docs;

            // After loading tasks check to see if any assignments have exceeded the timeout.
            for (var i = 0; i < tasks.length; i++) {
                var task = tasks[i];
                var taskTimeout = task.timeout || timeout;
                if (task.assigned && !task.assigned.completed && task.assigned.when && task.assigned.when + taskTimeout / 1000 < moment().unix()) {
                    errorTask(task, null, 'Master started with stale task.', 'Task assigned ' + moment.unix(task.assigned.when).format());
                }
            }
            tasksLoaded = true;

            if (tasks.length > 0) {
                assignTasks();
            }
        });
    });


    /**
     * When a worker establishes/reestablishes connection
     */
    io.on('connection', function (socket) {
        Log.info('Worker connected.  (', findWorkers().length, ')');


        /**
         * When the worker disconnects
         */
        socket.on('disconnect', function () {
            Log.warn('Worker disconnected.  (', findWorkers().length, ')');
        });


        /**
         * When the socket has an error
         */
        socket.on('error', function (err) {
            Log.error({err:err}, "A socket had an error");
        });


        /**
         * When the worker requests a task
         */
        socket.on('task:request', function () {
            socket._idleWorker = true;

            assignTasks();
        });


        /**
         * When a worker worker finishes a task
         */
        socket.on('task:done', function (taskJSON) {
            clearTimeout(socket._timer);

            // Update the task and save it to the database.
            var taskParsed = JSON.parse(taskJSON);
            var task = _.find(tasks, "_id", mongoose.Types.ObjectId(taskParsed._id));
            task.assigned.completed = moment().unix();

            Log.info({module: task.module}, 'Task completed'); // TODO: Indicate worker name
            task.save(function (err) {
                if (err) return Log.error({err:err}, 'Error updating task status as complete to mongodb');

                assignTasks();
            });
        });

        /**
         * When a worker worker has a task error
         */
        socket.on('task:error', function (err, taskJSON) {
            // Delete assigned state so task can be reassigned
            var taskParsed = JSON.parse(taskJSON);
            var task = _.find(tasks, "_id", mongoose.Types.ObjectId(taskParsed._id));
            errorTask(task, this, 'Task error', err)
        });


        /**
         * When a worker wants to add tasks to the list
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

            // TODO: Develop some anti-duplication logic, either in code or allow communication with the Feeder.
            async.each(newTasks, addNewTask, function (err) {
                if (err) {
                    socket.emit('task:error', err);
                    return Log.error({err:err}, 'Error while adding tasks');
                }

                socket.emit('task:added', 'Tasks have been successfully added', newTasks);
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
        var socket;

        while((task = findNextTask()) && (socket = findIdleWorker())) {
            saveAssignedTask(task, socket);
        }
    }

    /**
     * Handles errors from or related to tasks. Logs error, stops any timers associated with task, and clears assignment.
     */
    function errorTask(task, socket, message, err) {
        Log.error({err:err}, message);

        task.assigned = undefined;
        if (socket) {
            socket._idleWorker = true;
            clearTimeout(socket._timer);
        }

        task.save(function (err) {
            if (err) return Log.error({err:err}, 'Error un-assigning task assignment to mongodb');

            assignTasks();
        });
    }

    /**
     * Save a newly assigned task to the database then send the task to the worker.
     *
     * @param task
     * @param socket
     */
    function saveAssignedTask(task, socket) {
        // Mark the task as assigned
        task.assigned.who = 'workername'; // TODO: Pull the worker name from the socket
        task.assigned.when = moment().unix();

        // Use global timeout unless specific task timeout is set.
        var taskTimeout = task.timeout || timeout;

        socket._timer = setTimeout((function () {
            errorTask(this.task, this.socket, 'Task timed out without response from client.', 'Task assigned ' + moment.unix(this.task.assigned.when).format());
        }).bind({task: task, socket: socket, timeout: taskTimeout}), taskTimeout);

        task.save(function (err) {
            if (err) return errorTask(task, socket, 'Failed to update task.', err);

            socket.emit('task:send', JSON.stringify(task));
            Log.info({module: task.module, assignee: task.assigned.who}, 'Task sent');
        });
    }

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
     * Finds a worker with an idle worker and decreases the idle worker count before returning the socket
     */
    function findIdleWorker() {
        // Get the first worker with idle workers.
        var socket = _.find(findWorkers(), function(worker) {
            return worker._idleWorker;
        });

        // If an idle worker is set idleWorker to false and return it.
        if (socket) {
            socket._idleWorker = false;
            return socket;
        }

        return null;
    }


    /**
     * Searches for workers connected to the socket.io master (Copied from some where online)
     *
     * @param {String} [namespace] - Filter workers by namespace
     * @param {String} [room] - Filter workers by room
     * @returns {Array} - List of workers
     */
    function findWorkers(namespace, room) {
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
