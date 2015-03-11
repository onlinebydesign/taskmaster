"use strict";
/**
 * Created by Online By Design LLC.
 *
 * The runner requests for tasks from the master and starts a new worker for each task
 */

var child = require('child_process');

/**
 * Runner is initialized here
 *
 * @param options - Options for the runner.  Includes timeout, maxWorkers
 */
module.exports = function (options) {
    var runnerMaxWorkers = options.runnerMaxWorkers || 1;

    // Create maxWorkers number of workers
    for (var i = 0; i < runnerMaxWorkers; i++) {
        child.spawn('node', ['worker.js'], {detached: true, stdio: ['ignore', out, error]});
    }
};