/**
 * Created by James on 2/8/2015.
 *
 * The master is in charge of keeping track of task requests from the runners and assigning tasks as they become available.
 * The master also manages adding and updating tasks in the mongodb
 */

console.log('master started');

var socketIo = require('socket.io');
var mongoose = require('mongoose');
var _ = require('lodash');
mongoose.connect('mongodb://localhost/taskrunner');


// Load models
var Task = require('./../models/tasks');

// Variables
var tasks = [];
var tasksLoaded = false;

// Connect to database and get the list of tasks
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
    Task.find(function (err, docs) {
        if (err) return console.error(err);

        tasks = docs;
        tasksLoaded = true;
    });
});

/**
 * Master is initialized here
 *
 * @param port - The port to run the master on
 */
module.exports = function (port) {
    // Start socket.io on port
    var io = socketIo(port);

    /**
     * When a runner establishes/reestablishes connection
     */
    io.on('connection', function (socket) {
        console.log('Runner connected.\t(', findWorkers().length, ')');


        /**
         * When the runner disconnects
         */
        socket.on('disconnect', function () {
            console.log('Runner disconnected.\t(', findWorkers().length, ')');
        });


        /**
         * When the runner requests a task
         */
        socket.on('task:request', function () {
            // If a task is available then send it to the worker.
            var task = findNextTask();
            if (task) {
                socket.emit('task:send', JSON.stringify(task));
                socket._idle = false;
                console.log('Task sent', JSON.stringify(task));
            }
            else {
                socket._idle = true;
                console.log('No tasks available to assign');
            }
        });


        /**
         * When a runner worker finishes a task
         */
        socket.on('task:done', function (taskJSON) {
            console.log('Worker completed', taskJSON);

            // Update the task and save it to the database.
            var taskParsed = JSON.parse(taskJSON);
            var task = _.find(tasks, "_id", mongoose.Types.ObjectId(taskParsed._id));
            task.assigned.completed = Math.floor(Date.now() / 1000);
            task.save(function (err) {
                if (err) return console.log(err);

                // Assign tasks to idle runners
                var idleRunners;
                var task;
                while((idleRunners = findWorkers()) && (task = findNextTask())) {
                    // If a task is available then send it to the worker.
                    if (task) {
                        socket.emit('task:send', JSON.stringify(task));
                        socket._idle = false;
                        console.log('Task sent', JSON.stringify(task));
                    }
                }
            });

        });


        /**
         * When a runner worker has a task error
         */
        socket.on('task:error', function (msg) {
            console.log('Worker error', msg);
            // TODO: Log errors in a logs collection
            // TODO: Email when error occurs
            // TODO: Clear/reset assigned state so task can be reassigned
        });


        /**
         * When a runner wants to add tasks to the list
         */
        socket.on('task:add', function (tasks) {
            console.log('Worker added', tasks);
            // TODO: Make this work

            // TODO: if the tasks don't validate
            // emit a task:addError
            socket.emit('task:added', tasks);
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
        if (tasksLoaded) {
            return tasks[0];
        }
        return null;
    }


    /**
     * Searches for workers connected to the socket.io master
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
};
