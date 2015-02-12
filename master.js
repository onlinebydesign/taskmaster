/**
 * Created by James on 2/8/2015.
 *
 * The master is in charge of keeping track of task requests from the runners and assigning tasks as they become available.
 * The master also manages adding and updating tasks in the mongodb
 */

var io = require('socket.io')(3000);
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/taskrunner');


// Load models
var Task = require('./models/tasks');

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
    socket.on('task:request', function (msg) {

        // If a task is available then send it to the worker.
        var task = findNextTask();
        if (task) {
            socket.emit('task:send', JSON.stringify(task));
            console.log('Worker submitted', JSON.stringify(task));
        }
        else {
            // TODO: Keep a list of runners that are waiting for a task
        }
    });


    /**
     * When a runner worker finishes a task
     */
    socket.on('task:done', function (taskJSON) {
        console.log('Worker completed', taskJSON);

        // Record in the database that the task is done.
        // TODO: Update the task as completed
        //Task.update();
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
    if(tasksLoaded) {
        return tasks[0];
    }
    return null;
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
