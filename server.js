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
 * When a client establishes/reestablishes connection
 */
io.on('connection', function (socket) {
    console.log('Clients connected: ', findClients().length);


    /**
     * When the client disconnects
     */
    socket.on('disconnect', function () {
        console.log('Clients connected: ', findClients().length);
    });


    /**
     * When the client requests a task
     */
    socket.on('task request', function (msg) {

        // If a task is available then send it to the client.
        var task = findNextTask();
        if (task) {
            socket.emit('task send', JSON.stringify(task));
            console.log('Task submitted', JSON.stringify(task));
        }
    });


    /**
     * When the client finishes a task
     */
    socket.on('task done', function (taskJSON) {
        console.log('Task completed', taskJSON);
    });


    /**
     * When the client has a task error
     */
    socket.on('task error', function (msg) {
        console.log('Task error', msg);
    });


    /**
     * When the client wants to add tasks to the list
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
 * Searches for clients connected to the socket.io server
 *
 * @param namespace - Filter clients by namespace
 * @param room - Filter clients by room
 * @returns {Array}
 */
function findClients(namespace, room) {
    var clients = [], ns = io.of(namespace || "/");

    if (ns) {
        for (var id in ns.connected) {
            if (room) {
                var index = ns.connected[id].rooms.indexOf(room);
                if (index !== -1) {
                    clients.push(ns.connected[id]);
                }
            } else {
                clients.push(ns.connected[id]);
            }
        }
    }
    return clients;
}
