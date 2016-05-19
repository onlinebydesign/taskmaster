'use strict';
/**
 * Created by Online By Design LLC.
 *
 * The runner requests for tasks from the master and starts a new worker for each task
 */

var child = require('child_process');

/**
 * Runner is initialized here
 *
 * @param config - Options for the runner.  Includes timeout, maxWorkers
 */
module.exports = function (config) {
    var debug = typeof v8debug === 'object';

    // Create maxWorkers number of workers
    for (var i = 0; i < config.runner.maxWorkers; i++) {
         if (debug) {   
            process.execArgv.push('--debug=' + (5860 + i));    
        }    

        child.spawn('node', ['lib/worker.js'], {detached: true, stdio: ['ignore', 'ignore', 'ignore']});
    }
};
