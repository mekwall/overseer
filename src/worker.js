// Module dependencies
const cluster = require("cluster");

process.on("uncaughtException", function (err) {
    process.send({ type: "uncaughtException", data: { message: err.message, stack: err.stack } });
    process.exit(1);
});

// Override console
console.log = function () {
    process.send({ type: "console", method: "log", data: [].slice.call(arguments, 0) });
};

console.error = function () {
    process.send({ type: "console", method: "error", data: [].slice.call(arguments, 0) });
};

console.info = function () {
    process.send({ type: "console", method: "info", data: [].slice.call(arguments, 0) });
};

console.warn = function () {
    process.send({ type: "console", method: "warn", data: [].slice.call(arguments, 0) });
};

console.debug = function () {
    process.send({ type: "console", method: "debug", data: [].slice.call(arguments, 0) });
};

if (!cluster.isWorker) {
    console.error("This file must be run as a worker");
    process.exit(0);
}

process.on("message", function(msg){
    if (msg.cmd) {
        switch (msg.cmd) {
            case "reload":
                delete require.cache[msg.file];
            break;

            case "stat":
                process.send("stat", {
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage()
                })
            break;
        }
    }
});

// enable workers to ask for a cluster restart
cluster.on("restart", function () {
    process.send("restart");
});

var APPFILE = process.argv[2];
module.exports = require(APPFILE);