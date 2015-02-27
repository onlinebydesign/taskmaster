/**
 * Created by James on 2/8/2015.
 *
 * The master is in charge of keeping track of task requests from the runners and assigning tasks as they become available.
 * The master also manages adding and updating tasks in the mongodb
 */

/**
 * Master is initialized here
 *
 * @param port - The port to run the master on
 */
module.exports = function (config) {
    //var express = require('express');
    //var connect = require('connect');
    var io = require('socket.io')(config.port || 3000);
    var mongoose = require('mongoose');
    var _ = require('lodash');
    var Log = require('./logger');

    // Load models
    var Task = require('../models/tasks');

    // Module configuration
    mongoose.connect('mongodb://localhost/taskrunner');

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
            socket._idleWorkers++;

            // If a task is available then send it to the worker.
            var task = findNextTask();
            if (task) {
                socket._idleWorkers--;
                // Mark the task as assigned
                task.assigned.who = 'runnername';
                task.assigned.when = Math.floor(Date.now() / 1000);
                task.save(function (err) {
                    if (err) return Log.error({err:err}, 'Error saving task to mongodb');

                    socket.emit('task:send', JSON.stringify(task));
                    Log.info('Task sent'); // TODO: Indicate module and runner name
                });

            }
            else {
                Log.info('No tasks available to assign');
            }
        });


        /**
         * When a runner worker finishes a task
         */
        socket.on('task:done', function (taskJSON) {
            Log.info('Task completed'); // TODO: Indicate module and runner name

            // Update the task and save it to the database.
            var taskParsed = JSON.parse(taskJSON);
            var task = _.find(tasks, "_id", mongoose.Types.ObjectId(taskParsed._id));
            task.assigned.completed = Math.floor(Date.now() / 1000);
            task.save(function (err) {
                if (err) return Log.error({err:err}, 'Error updating task status as complete to mongodb');

                // TODO: When a task is done we need to start assigning tasks to all runners that have idleWorkers
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
        socket.on('task:add', function (tasks) {
            Log.info('Task added'); // TODO: Indicate what tasks were added to the list
            // TODO: Make this work

            // TODO: if the tasks don't validate return an error

            // TODO: When a task is done we need to start assigning tasks to all runners that have idleWorkers
        });


    });
    /***********************************************************************************************************************
     * Search functions
     **********************************************************************************************************************/


    /**
     * Finds the next available task
     */
    function findNextTask() {
        // Sort the tasks by priority
        // TODO: Have it correctly send the next available task based on priority, dependencies, and assignment
        if (tasksLoaded) {
            return tasks[0];
        }
        return null;
    }


    /**
     * Searches for runners connected to the socket.io master
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
