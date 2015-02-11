/**
 * Created by James on 2/8/2015.
 */

var io = require('socket.io')(3000);
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/taskrunner');


// Load models
var Tasks = require('./models/tasks');

/**
 * When a client establishes/reestablishes connection
 */
io.on('connection', function (socket) {
    console.log('Workers connected: ', findWorkers().length);


    /**
     * When the client disconnects
     */
    socket.on('disconnect', function () {
        console.log('Workers connected: ', findWorkers().length);
    });


    /**
     * When the client worker requests a task
     */
    socket.on('taskRequest', function (msg) {

        // If a task is available then send it to the worker.
        var task = findNextTask();
        if (task) {
            socket.emit('taskSend', JSON.stringify(task));
            console.log('Worker submitted', JSON.stringify(task));
        }
    });


    /**
     * When the client worker finishes a task
     */
    socket.on('taskDone', function (taskJSON) {
        console.log('Worker completed', taskJSON);

        // Record in the database that the task is done.
        // TODO: Update the task as complted
        //Tasks.update();
    });


    /**
     * When the client worker has a task error
     */
    socket.on('taskError', function (msg) {
        console.log('Worker error', msg);
    });


    /**
     * When the client wants to add tasks to the list
     */
    socket.on('taskAdd', function (tasks) {
        console.log('Worker added', tasks);
    });
});


/***********************************************************************************************************************
 * Search functions
 **********************************************************************************************************************/


/**
 * Finds the next available task
 */
function findNextTask() {
    var tasks = [];
    // Connect to database and get the list of tasks
    Tasks.find(function (err, results) {
        if (err) return console.error(err);

        tasks = results;
    });

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
