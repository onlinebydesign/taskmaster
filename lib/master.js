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
    var io = require('socket.io')(config.master.port);
    var mongoose = require('mongoose');
    var _ = require('lodash');
    var async = require('async');
    var moment = require('moment');
    var log = require('../logger');

    // Error if logger.js is not loaded.
    if (!log) return console.error('Please create logger.js in the root directory.  You may copy and save logger.example.js as logger.js.  See the documentation for more information.');

    // Load models
    var Task = require('../models/tasks');

    // Keep a variable so we know if we are in the process of assigning tasks.
    var assigningTasks = false;

    // Module configuration
    mongoose.connect(config.master.mongoURL);
    log.info('Started Master');

    // Connect to database and get the list of tasks
    var db = mongoose.connection;
    db.on('error', function (err) {
        log.error(err, 'Failed to connect to mongo database');
    }); // TODO: test this out

    db.once('open', function () {

        // Find all of the tasks that are neither complete nor assigned
        Task.where('task.assigned').exists(false)
            .where('task.completed').exists(false)
            .exec(function (err, tasks) {
                if (err) return log.error(err, 'Error when finding tasks');

                if (tasks.length > 0) {
                    assignTasks();
                }
            });
    });


    /**
     * When a worker establishes/reestablishes connection
     */
    io.on('connection', function (socket) {
        log.info('Worker connected.  (', findWorkers().length, ')');


        /**
         * When the worker disconnects
         */
        socket.on('disconnect', function () {
            log.warn('Worker disconnected.  (', findWorkers().length, ')');
        });


        /**
         * When the socket has an error
         */
        socket.on('error', function (err) {
            log.error({err: err}, "A socket had an error.");
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
            // Update the task and save it to the database.
            var taskParsed = JSON.parse(taskJSON);
            Task.findById(taskParsed._id, function (err, task) {
                if (err) log.error({err: err}, 'Error finding task to mark as complete');

                task.assigned.completed = moment().unix();
                task.assigned.status = 'done';
                task.save(function (err) {
                    if (err) return log.error({err: err}, 'Error updating task status as done');

                    log.info({task: task}, 'Task completed');
                    assignTasks();
                });
            });
        });

        /**
         * When a worker worker has a task error
         */
        socket.on('task:error', function (err, taskJSON) {
            var taskParsed = JSON.parse(taskJSON);

            // Delete assigned state so task can be reassigned
            Task.findById(taskParsed._id, function (err, task) {
                if (err) return log.error({err: err}, 'Error finding task passed in from an error');

                task.assigned.status = 'error';
                task.save(function (err) {
                    if (err) log.error({err: err}, 'Error updating task status as error');

                    log.error({task: task}, 'Task error');
                });
            });
        });


        /**
         * When a worker wants to add tasks to the list
         *
         * @param Array tasks - An array of task objects (in JSON format)
         */
        socket.on('task:add', function (tasks) {
            log.info({tasks: tasks}, 'Task added');
            tasks = _.isArray(tasks) ? tasks : [tasks];

            async.each(tasks, function (task, next) {

                // Only allow one task with a given module, params, and dependencies
                Task.update({
                    module: task.module,
                    params: task.params,
                    dependencies: task.dependencies
                }, task, {upsert: 1}, function (err) {
                    if (err) return next(err, task);

                    log.info({task: task}, 'Task added');
                    socket.emit('task:add:confirm');
                    next();
                });
            }, function (err, task) {
                if (err) return log.error({err: err, task: task}, 'Error while adding task');

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
        if (!assigningTasks) {
            assigningTasks = true;

            var socket;
            var task;

            // While there is an idle worker
            async.during(
                function (callback) {
                    // Find an idle worker.
                    socket = _.find(findWorkers(), function (worker) {return worker._idleWorker});

                    // Find an available task
                    findNextTask(function (nextTask) {
                        task = nextTask;
                        callback(null, !_.isEmpty(socket) && !_.isEmpty(task));
                    });
                },
                function (next) {
                    // Mark the task as assigned
                    task.assigned.who = 'workername'; // TODO: Pull the worker name from the socket
                    task.assigned.when = moment().unix();
                    task.assigned.status = 'assigned';

                    task.save(function (err) {
                        if (err) return next(err);

                        socket.emit('task:run', JSON.stringify(task));
                        socket._idleWorker = false;
                        log.info({task: task}, 'Task sent');
                        next();
                    });
                },
                function (err) {
                    if (err) log.error({err: err}, 'Error assigning task');
                    assigningTasks = false;
                }
            );
        }
    }

    /**
     * Finds the next available task.
     * Next available task is one that:
     *  - has not been assigned
     *  - is sorted by priority descending
     *  - is sorted by created ascending
     *  and:
     *  - has no dependencies unmet
     */
    function findNextTask(callback) {
        // Find all tasks that have not been assigned yet
        Task.where('assigned').exists(false)
            .sort('-priority created')
            .exec(function (err, unassignedTasks) {
                if (err) return log.error(err, 'Unable to connect to database to get an unassigned task');
                // Find a task whose dependencies are complete
                async.detectSeries(unassignedTasks, function (unassignedTask, next) {
                    Task.where('assigned.completed').exists(true).or(unassignedTask.dependencies).exec(function (err, completedDependencyTasks) {
                        // If every dependency matches any completedDependency then we have found the next task
                        next(_.every(unassignedTask.dependencies, function (dependency) {
                            return _.any(completedDependencyTasks, function (completedDependencyTask) {
                                return _.isMatch(completedDependencyTask.toObject(), dependency);
                            })
                        }));
                    });
                }, function (taskToAssign) {
                    callback(taskToAssign);
                });
            }
        );
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
