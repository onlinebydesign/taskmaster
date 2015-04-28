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
    var io = require('socket.io')(config.masterPort || 3000);
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
    var timeout = config.workerTimeout || 300000; // 5 minutes is the default timeout time for master
    var assigningTasks = 0;

    // Connect to database and get the list of tasks
    var db = mongoose.connection;
    db.on('error', function (err) {
        Log.error({err: err}, 'Could not connect to mongodb')
    }); // TODO: test this out
    db.once('open', function () {
        // Query: {'task.assigned': {$exists: true}, 'task.completed': {$exists: false}}
        Task.where('task.assigned').exists(true)
            .where('task.completed').exists(false)
            .exec(function (err, tasks) {
                if (err) return Log.error({err: err}, 'Error when finding tasks'); // TODO: test this out

                var startTime = moment().unix();

                // After loading tasks check to see if any assignments have exceeded the timeout.
                for (var i = 0; i < tasks.length; i++) {
                    var task = tasks[i];
                    var taskTimeout = task.timeout || timeout;
                    // TODO: if the task was assigned then add a timer if it isn't stale.
                    if (task.assigned && !task.assigned.completed && task.assigned.when && task.assigned.when + taskTimeout / 1000 < startTime) {
                        errorTask(task, null, 'Master started with stale task.', 'Task assigned ' + moment.unix(task.assigned.when).format());
                    }
                }

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
            Log.error({err: err}, "A socket had an error");
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
            // Query: {'_id': taskParsed._id}
            // Limit: 1
            Task.where('_id').equals(mongoose.Types.ObjectId(taskParsed._id)).limit(1).exec(function (err, tasks) {
                if (err || tasks.length === 0) {
                    Log.error({err: err}, 'Error finding task to mark as completed');

                    assignTasks();
                } else {
                    var task = tasks.shift();
                    task.assigned.completed = moment().unix();

                    Log.info({module: task.module}, 'Task completed'); // TODO: Indicate worker name
                    task.save(function (err) {
                        if (err) return Log.error({err: err}, 'Error updating task status as complete to mongodb');

                        assignTasks();
                    });
                }
            });
        });

        /**
         * When a worker worker has a task error
         */
        socket.on('task:error', function (err, taskJSON) {
            // Delete assigned state so task can be reassigned
            var taskParsed = JSON.parse(taskJSON);

            // Query: {'_id': taskParsed._id}
            // Limit: 1
            Task.where('_id').equals(mongoose.Types.ObjectId(taskParsed._id)).limit(1).exec(function (newErr, tasks) {
                if (newErr) Log.error({err: newErr}, 'Error finding task passed in from an error');

                var task = {task: 'No task defined'};

                if (tasks && tasks.length > 0) {
                    task = tasks.shift();
                }

                errorTask(task, this, 'Task error', err);
            });
        });


        /**
         * When a worker wants to add tasks to the list
         */
        socket.on('task:add', function (newTasks) {

            function addNewTask(newTask, done) {
                var task = new Task(newTask);
                task.save(function (err) {
                    if (err) done(err);

                    done()
                })
            }

            // TODO: Develop some anti-duplication logic, either in code or allow communication with the Feeder.
            async.each(newTasks, addNewTask, function (err) {
                if (err) {
                    socket.emit('task:error', err);
                    return Log.error({err: err}, 'Error while adding tasks');
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
        if (!assigningTasks) {
            assigningTasks = true;

            var task;
            var socket;

            async.forever(
                function (next) {
                    findNextTask(function (err, returnedTask) {
                        if (err) next(err);

                        if (returnedTask) {
                            task = returnedTask;
                            if ((socket = findIdleWorker())) {
                                saveAssignedTask(task, socket, next);
                            } else {
                                next('Done');
                            }
                        } else {
                            next('Done');
                        }
                    })
                },
                function (err) {
                    if (err !== 'Done') Log.error({err: err}, 'Error assigning task.');

                    // Even if we have an error we still need to stop assigning tasks.
                    assigningTasks = false;
                }
            );
        }
    }

    /**
     * Handles errors from or related to tasks. Logs error, stops any timers associated with task, and clears assignment.
     */
    function errorTask(task, socket, message, err) {
        if (socket) {
            clearTimeout(socket._timer);

            socket._idleWorker = true;
            socket.emit('task:cancel', JSON.stringify(task));
        }

        // It is possible that a break in communication resulted in the worker moving to a different socket and completing
        // the task but it still times out since the timer is attached to the socket.
        if (task.assigned.completed) {
            Log.error({err: err}, message, 'Even though the task returned an error it was marked as complete by a worker.');

            assignTasks();
        } else {
            Log.error({err: err}, message);

            if (task) {
                task.assigned = undefined;

                task.save(function (err) {
                    if (err) return Log.error({err: err}, 'Error un-assigning task assignment to mongodb');

                    assignTasks();
                });
            } else {
                assignTasks();
            }
        }
    }

    /**
     * Save a newly assigned task to the database then send the task to the worker.
     *
     * @param task
     * @param socket
     * @param done
     */
    function saveAssignedTask(task, socket, done) {
        // Mark the task as assigned
        task.assigned.who = 'workername'; // TODO: Pull the worker name from the socket
        task.assigned.when = moment().unix();

        task.save(function (err) {
            if (err) done(err);

            // Use global timeout unless specific task timeout is set.
            var taskTimeout = task.timeout || timeout;

            socket._timer = setTimeout((function () {
                errorTask(this.task, this.socket, 'Task timed out without response from client.', 'Task assigned ' + moment.unix(this.task.assigned.when).format());
            }).bind({task: task, socket: socket, timeout: taskTimeout}), taskTimeout);

            socket.emit('task:send', JSON.stringify(task));
            Log.info({module: task.module, assignee: task.assigned.who}, 'Task sent');
            done();
        });
    }

    /**
     * Finds the next available task
     */
    function findNextTask(callback) {

        var returnTask;
        var offset = 0;

        // A queue to check for dependencies. If there is an unmet dependency then it kills the queue since we don't
        // need to keep checking this task anymore.
        var dependencyQueue = async.queue(function (options, queueDone) {
            var dependency = options.dependency;
            var done = options.done;
            // Query: {'assigned.completed': {$exists: true}, 'module': dependency.module, 'params': dependency.params}
            Task.where('assigned.completed').exists(true)
                .where('module').equals(dependency.module)
                .where('params').equals(dependency.params)
                .limit(1)
                .exec(function (err, completedTasks) {
                    if (err) queueDone(err);
                    if (completedTasks.length > 0) {
                        queueDone();
                    } else {
                        dependencyQueue.kill();
                        done();
                    }
                });
        },1);

        async.doUntil(
            function (done) {
                // Sort the tasks by reversed priority
                // Query: {assigned: {$exists: false}}
                // Sort: {priority: -1, created: 1}
                // Limit: 1
                Task.where('assigned').exists(false)
                    .sort('-priority')
                    .sort('created')
                    .limit(1)
                    .skip(offset)
                    .exec(function (err, tasks) {

                        // We are checking returnTask to see when it isn't undefined to determine if we are done but if
                        // we are at the end of the task list then we need to still say we are done so we set returnTask
                        // to null.
                        if (tasks.length === 0) {
                            returnTask = null;
                            done();
                        } else {
                            var task = tasks[0];

                            offset++;

                            var dependencies = task.dependencies;

                            // If there are dependencies we need to check if they are completed.
                            if (dependencies.length > 0) {

                                // Drain is only called if all dependencies are met so we set the return task when it is
                                // called. The queue is killed otherwise.
                                dependencyQueue.drain = function () {
                                    returnTask = task;
                                    done();
                                };

                                // Add all the dependencies to the queue.
                                for (var i = 0; i < dependencies.length; i++) {
                                    dependencyQueue.push({dependency: dependencies[i], done: done});
                                }
                            } else {
                                // No dependencies exist so this is the task to return.
                                returnTask = task;
                                done();
                            }
                        }
                    });
            },
            function () {
                // If returnTask is ever set then we are done with our loop.
                if (!_.isUndefined(returnTask)) return true;
            },
            function (err) {
                if (err) callback(err);

                // Return whatever we have at the end of our task search.
                callback(null, returnTask);
            }
        );

    }

    /**
     * Finds a worker with an idle worker and decreases the idle worker count before returning the socket
     */
    function findIdleWorker() {
        // Get the first worker with idle workers.
        var socket = _.find(findWorkers(), function (worker) {
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
