/**
 * Created by James on 2/9/2015.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var taskSchema = new Schema({
    "created": Number,
    "priority": Number,
    "assigned": {
        "who": String,
        "when": Number,
        "completed": Number
    },
    "task": String,
    "params": [Schema.Types.Mixed],
    "dependencies": [Schema.Types.Mixed]
});

module.exports = mongoose.model('Worker', taskSchema);