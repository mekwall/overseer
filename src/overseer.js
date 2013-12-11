// Module dependencies
const pkg = require("../package.json");
const cluster = require("cluster");
const fs = require("fs");
const path = require("path");
const events = require("events");
const clc = require("cli-color");

// Replace console
console = require("./logger")(console);

// Make sure this is the master
if (!cluster.isMaster) {
    console.log("overseer can only be run as master");
    process.exit(0);
}

var overseer = Object.create(events.EventEmitter.prototype);

// Default options
var APPFILE = "./app.js";
var PIDFILE = "./overseer.pid";
var ENV = process.env["NODE_ENV"] || "development";
var FORKS = 0 + require("os").cpus().length;
var WATCH = false;
var CMD = false;

// Cool ascii art banner
var banner = "\n"+
"  _____   _____ _ __ ___  ___  ___ _ __ \n"+
" / _ \\ \\ / / _ \\ '__/ __|/ _ \\/ _ \\ '__|\n"+
"| (_) \\ V /  __/ |  \\__ \\  __/  __/ |   \n"+
" \\___/ \\_/ \\___|_|  |___/\\___|\\___|_|  \n"+ 
"                                        \n";

// Container of workers
overseer.workers = [];

// Fork a new worker
overseer.fork = function () {
    var worker = cluster.fork();
    var pid = worker.process.pid;
    var timeout;

    console.info("W-%s: I'm alive!", worker.process.pid);

    worker.on("disconnect", function() {
        console.debug("W-%s: Disconnected", pid);
    });

    worker.on("message", function (msg) {
        if (msg.type) {
            switch (msg.type) {

                case "uncaughtException":
                    overseer.halt = true;
                    var err = msg.data;
                    err.stack = err.stack.replace(/\n/g, "\n\t");
                    console.error(clc.red.bold("W-%s: Uncaught Exception: %s\n\n\t"), pid, err.message, clc.red.bold(err.stack), "\n");
                    worker.destroy();
                    overseer.delayedFork(5000, function(){
                        overseer.halt = false;
                    });
                break;

                case "console":
                    if (typeof msg.data[0] === "string") {
                        msg.data[0] = "W-" + pid + ": " + msg.data[0];
                    } else {
                        msg.data.unshift("W-" + pid + ": ");
                    }
                    console[msg.method].apply(console, msg.data);
                break;

                case "restart":
                    overseer.restartWorkers();
                break;
            }
        }
    });

    worker.on("error", function(err) {
        console.error("W-" + pid + ": %s", err);
    });

    /*
    worker.process.stdout.on("data", function (data) {
        process.stdout.write("W-" + pid + ": ");
        process.stdout.write(data);
    });
    */

    overseer.workers.push(worker);
    return worker;
};

overseer._runnning = false;

// Run the overseer
overseer.run = function() {
    if (overseer._running) {
        console.log("Master: Overseer is already running.");
        return;
    };

    // Write out banner
    process.stdout.write(banner);

    // Save some references
    this.cluster = cluster;
    this.process = process;

    // Make sure path of APPFILE is correct
    if (APPFILE.substring(0, 2) === "./") {
        APPFILE = path.join(process.cwd(), APPFILE);
    }

    // Make sure path of PIDFILE is correct
    if (PIDFILE.substring(0, 2) === "./") {
        PIDFILE = path.join(process.cwd(), PIDFILE);
    }

    // Check if we have an existing pidfile
    if (fs.existsSync(PIDFILE)) {
        var extPid = fs.readFileSync(PIDFILE).toString();
        if (extPid) {
            if (CMD) {
                switch (CMD) {
                    case "restart":
                        console.info("Sent SIGUSR2 to PID %s", extPid);
                        process.kill(extPid, "SIGUSR2");
                    break;

                    case "stop":
                        console.info("Sent SIGHUP to PID %s", extPid);
                        process.kill(extPid, "SIGHUP");
                    break;

                    case "clean":
                        console.log("Cleaned up PIDFILE for %s", extPid);
                        fs.unlinkSync(PIDFILE);
                    break;
                }
            } else {
                console.error("Cluster is already running with PID %s", extPid);
            }
            process.exit(0);
        }
    }

    fs.writeFileSync(PIDFILE, process.pid);

    process.on("exit", function(){
        console.info("Master: Shutting down...");
        fs.unlinkSync(PIDFILE);
    });

    require("./signals")(overseer);

    if (WATCH) {
        const watch = require("watch");
        var watchPath = path.dirname(APPFILE);
        var criticalRxp = new RegExp("^(" + path.basename(APPFILE) + "|src\/|models\/|node_modules\/)");
        var assetRxp = new RegExp("^(assets\/|public\/|static\/|views\/)");
        watch.createMonitor(watchPath, function (monitor) {
            console.info("Master: Watching for file system changes.");
            monitor.on("created", function (f, stat) {
                if (!overseer._running || !overseer._restartingWorkers) {
                    return;
                }
            });
            monitor.on("changed", function (f, curr, prev) {
                if (!overseer._running || !overseer._restartingWorkers) {
                    return;
                }
                f = f.replace(watchPath, "");
                f = f.replace(/\\/g, "/");
                if (f[0] === "/") {
                    f = f.substr(1);
                }
                if (criticalRxp.test(f)) {
                    console.info("Master: Change in %s detected.", f);
                    overseer.emit("restartWorkers");
                    return;
                }
                if (assetRxp.test(f)) {
                    console.info("Master: Changes in %s detected.", f);
                    console.info("Master: Informing workers...");
                    overseer.emit("messageWorkers", {
                        cmd: "file:change",
                        data: f
                    });
                    return;
                }
            });
            monitor.on("removed", function (f, stat) {
                if (!overseer._running || !overseer._restartingWorkers) {
                    return;
                }
            });
        });
    }

    // Setup master
    cluster.setupMaster({
        exec: __dirname + "/worker.js",
        args: [APPFILE],
        silent : true
    });

    // Fork a new worker if it dies
    cluster.on("exit", function (worker, code, signal) {
        var pid = worker.process.pid;
        if (worker.suicide === true) {
            console.warn("W-%s: Suicided", pid);
        } else {
            console.error("W-%s: Died", pid);
            setTimeout(function(){
                overseer.fork();
            }, 1000);
        }
        // Remove worker from container
        overseer.workers.splice(overseer.workers.indexOf(worker), 1);
    });
    overseer.startCluster();
};

overseer.startCluster = function () {
    console.info("Master: Setting up cluster.");
    console.info("Master: Forking %d workers...", FORKS);

    overseer._running = false;
    // Fork first worker
    var firstWorker = overseer.fork();
    var firstRun = true;
    firstWorker.once("listening", function () {
        firstRun = false;
        // Fork the rest once we know everything went ok
        for (var i = 1; i < FORKS; i++) {
            overseer.delayedFork(i*500);
        }
        overseer._running = true;
    });
    firstWorker.once("disconnect", function () {
        if (firstRun) {
            console.error("Retrying in 5 seconds...");
            setTimeout(function(){
                overseer.startCluster();
            }, 5000);
        }
    });
};

overseer.delayedFork = function (delay, cb) {
    setTimeout(function(){
        if (overseer.halt) {
            overseer.delayedFork();
        } else {
            var fork = overseer.fork();
            if (typeof cb === "function") {
                cb(fork);
            }
        }
    }, delay);
}

overseer._restartingWorkers = false;
overseer.on("restartWorkers", function(cb) {
    if (overseer._restartingWorkers === true) {
        if (typeof cb === "function") {
            cb(false);
        }
        return false;
    }
    var len = overseer.workers.length;
    var oldWorkers = [].concat(overseer.workers.slice(0));
    console.info("Master: Restarting %s workers...", FORKS);

    for (var i = 1; i < len; i++) {
        oldWorkers[i].on("exit", function(){
            var newWorker = overseer.fork();
            if (oldWorkers.length) {
                newWorker.once("disconnect", function (msg) {
                    overseer._restartingWorkers = false;
                    console.log("Something went wrong!!");
                    setTimeout(function(){
                        overseer.emit("restartWorkers");
                    }, 5000);
                });
                newWorker.once("listening", function(){
                    var nextWorker = oldWorkers.shift();
                    if (nextWorker) {
                        nextWorker.destroy();
                    } else if (len !== FORKS) {
                        for (var i = 1; i < (FORKS-len); i++) {
                            overseer.delayedFork(i*500);
                        }
                    }
                });
            } else {
                overseer._restartingWorkers = false;
                if (typeof cb === "function") {
                    cb(true);
                }
            }
        });
    }

    oldWorkers.shift().destroy();
    overseer._restartingWorkers = true;
});

/**
 * Send message to all workers
 **/
overseer.on("messageWorkers", function(){
    Object.keys(cluster.workers).forEach(function (id) {
        cluster.workers[id].send(msg);
    });
});

module.exports = function () {
    var options = {};
    if (arguments.length) {
        if (typeof arguments[0] === "object") {
            options = arguments[0];
        } else if (typeof arguments[0] === "string") {
            APPFILE = arguments[0];
            if (arguments[1] && typeof arguments[1] === "object") {
                options = arguments[1];
            }
        }
    }
    if (options.file) {
        APPFILE = options.file;
    }
    if (options.pidfile) {
        PIDFILE = options.pidfile;
    }
    if (options.forks) {
        FORKS = 0+options.forks;
    }
    if (options.watch) {
        WATCH = options.watch;
    }
    return overseer;
};