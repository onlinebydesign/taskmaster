/**
 * The schema of the log entry
 * @type {Mongoose.Schema}
 */
var LogEntrySchema = new mongoose.Schema({
    msg: {
        type: String,
        required: true
    },
    level: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    time: {
        type: Date,
        required: true
    },
    res : {
        type: Object
    },
    req : {
        type: Object
    }
});

module.exports = mongoose.model('Log', LogEntrySchema);