/**
 * Created by James on 2/8/2015.
 */

var io = require('socket.io')(3000);
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/taskrunner');


// Load models
var Tasks = require('./models/tasks');
var tasks = [];

// Connect to database and get the list of tasks
Tasks.find(function (err, results) {
    tasks = results;
});


/**
 * When a worker establishes/reestablishes connection
 */
io.on('connection', function (socket) {
    console.log('Workers connected: ', findWorkers().length);


    /**
     * When the worker disconnects
     */
    socket.on('disconnect', function () {
        console.log('Workers connected: ', findWorkers().length);
    });


    /**
     * When the worker requests a task
     */
    socket.on('task request', function (msg) {

        // If a task is available then send it to the worker.
        var task = findNextTask();
        if (task) {
            socket.emit('task send', JSON.stringify(task));
            console.log('Task submitted', JSON.stringify(task));
        }
    });


    /**
     * When the worker finishes a task
     */
    socket.on('task done', function (taskJSON) {
        console.log('Task completed', taskJSON);
    });


    /**
     * When the worker has a task error
     */
    socket.on('task error', function (msg) {
        console.log('Task error', msg);
    });


    /**
     * When the worker wants to add tasks to the list
     */
    socket.on('task add', function (tasks) {
        console.log('Task added', tasks);
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

    return tasks[0];
}


/**
 * Searches for workers connected to the socket.io master
 *
 * @param namespace - Filter workers by namespace
 * @param room - Filter workers by room
 * @returns {Array}
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
