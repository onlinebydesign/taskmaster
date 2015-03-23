'use strict';
/**
 * Created by Online By Design LLC.
 *
 * This loads up either the master or the runner depending on what the role of this instance is.
 */

var config = require('./config.json');

config.role = process.argv[2] || config.role || 'runner';

/**
 * start app based on config file
 */
if (config.role === 'master') {
    require('./lib/master')(config);
} else if (config.role === 'runner') {
    require('./lib/runner')(config);
}