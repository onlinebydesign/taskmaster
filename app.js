/**
 * Created by James on 2/11/2015.
 *
 * This loads up either the master or the runner depending on what the role of this instance is.
 */

// TODO: Move the master and runner in a sub directory
var config = require('./config.json');

config.role = process.argv[2] || config.role;
//config.masterport = process.argv[3] || config.masterport;
//config.masterhost = process.argv[4] || config.masterhost;
//config.runnertimeout = process.argv[5] || config.runnertimeout;

/**
 * start app based on config file
 */
if (config.role === 'master') {
    require('./lib/master')(config.masterPort);
} else if (config.role === 'runner') {
    require('./lib/runner')(config.masterHost, config.masterPort, config.runnerTimeout);
}