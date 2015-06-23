/**
 * Created by James on 6/15/2015.
 */
var mongoose = require('mongoose');
var socketIo = require('socket.io-client');
var moment = require('moment');
var _ = require('lodash');
var assert = require('assert');

var config = _.defaults(require('../config.json'), {
    "version": 1,
    "role": "runner",

    "master": {
        "port": 3000,
        "host": "localhost",
        "mongoURL": "mongodb://localhost/taskrunner"
    },
    "runner": {
        "name": "archon", // TODO: Have runner automatically determine this by hostname
        "maxWorkers": 2, // TODO: Have runner automatically determine this default based on CPU Cores
        "taskFolder": "tasks",
        "worker": {
            "timeout": 300000 // 5 min
        }
    }
});

// Load models
var Task = require('../models/tasks');

// Start tests
describe('Master', function () {

    // Variables
    var socket;

    before('connect to database and master socket', function (done) {
        mongoose.connect(config.master.mongoURL, done);
        socket = socketIo('http://' + config.master.host + ':' + config.master.port);
    });

    describe('task:add', function () {

        // Variables
        var taskToAdd = {
            "created": moment().unix(),
            "timeout": 123,
            "assigned": {
                "who": 'tester',
                "when": moment().unix(),
                "status": 'testing'
            },
            "module": 'sampleTask',
            "params": [],
            "dependencies": []
        };

        before('send a task to the master', function (done) {
            socket.emit('task:add', JSON.stringify(taskToAdd));
            socket.once('task:add:confirm', done);
        });

        it('should save a task to the database', function (done) {
            // Variables
            var conditions = {
                module: taskToAdd.module,
                params: taskToAdd.params,
                dependencies: taskToAdd.dependencies
            };

            Task.findOne(conditions, {module: 1, params: 1, dependencies: 1, _id: 0}, function (err, task) {
                // Compare the module, params, and dependencies of the task
                assert.deepEqual(task.toObject(), conditions);
                done();
            });
        });

        it('should only be one of this task in the database', function () {
            socket.emit('task:add', JSON.stringify(taskToAdd));
            socket.once('task:add:confirm', function() {
                Task.find(conditions).count(function (err, count) {
                    assert.equal(count, 3);
                    done();
                });
            });
        });
    });

    after(function () {
        socket.disconnect();
        mongoose.disconnect();
    });
});
