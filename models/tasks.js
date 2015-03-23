'use strict';
/**
 * Created by Online By Design LLC.
 */

var mongoose = require('mongoose');
var moment = require('moment');

var Schema = mongoose.Schema;

var taskSchema = new Schema({
    "created": {type: Number, default: moment().unix()},
    "priority": {type: Number, default: 50},
    "timeout": Number,
    "assigned": {
        "who": String,
        "when": Number,
        "completed": Number
    },
    "module": String,
    "params": [Schema.Types.Mixed],
    "dependencies": [Schema.Types.Mixed]
});

module.exports = mongoose.model('Task', taskSchema);