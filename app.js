/**
 * Created by James on 2/11/2015.
 *
 * This loads up either the master or the runner depending on what the role of this instance is.
 */

// TODO: Move the master and runner in a sub directory
var config = require('./config.json');

config.role = process.argv[2] || config.role;

/**
 * start app based on config file
 */
if (config.role === 'master') {
    require('./lib/master')(config.masterPort);
} else if (config.role === 'runner') {
    require('./lib/runner')(config.masterHost, config.masterPort, {
        timeout: config.runnerTimeout,
        maxWorkers: config.runnerMaxWorkers
    });
}