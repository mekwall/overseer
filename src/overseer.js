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
var FORKS = require("os").cpus().length;
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
                    var err = msg.data;
                    err.stack = err.stack.replace(/\n/g, "\n\t");
                    console.error(clc.red.bold("W-%s: Uncaught Exception: %s\n\n\t"), pid, err.message, clc.red.bold(err.stack), "\n");
                    worker.destroy();
                    setTimeout(function(){
                        overseer.forkWorker();
                    }, 5000);
                break;

                case "console":
                    if (typeof msg.data[0] === "string") {
                        msg.data[0] = "W-" + pid + ": " + msg.data[0];
                    } else {
                        msg.data.unshift("W-" + pid + ": ");
                    }
                    console[msg.method].apply(console, msg.data);
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

    process.on("exit", function(){
        console.info("Master: Shutting down...");
        fs.unlinkSync(PIDFILE);
    });

    fs.writeFileSync(PIDFILE, process.pid);

    /**
     * Graceful restart/shutdown
     */
    process.on("SIGHUP",function(){
        console.info("Master: Received SIGHUP from system");
        process.emit("restartWorkers");
    });

    process.on("SIGUSR2",function(){
        console.info("Master: Received SIGUSR2 from system");
        overseer.workers.forEach(function (worker) {
            worker.send({ cmd: "stop" });
        });
    });

    process.on("SIGTERM", function () {
        console.info("Master: Received SIGTERM from system");
        process.exit();
    });

    process.on("SIGINT", function () {
        console.info("Master: Recieved SIGINT from system");
        process.exit();
    });

    // Windows doesn't use POSIX signals
    if (process.platform === "win32") {
        const keypress = require("keypress");
        keypress(process.stdin);
        process.stdin.resume();
        process.stdin.setRawMode(true);
        process.stdin.setEncoding("utf8");
        process.stdin.on("keypress", function(char, key) {
            if (key && key.ctrl && key.name == "c") {
                process.emit("SIGUSR2");
                process.exit(0);
            } else if (key && key.ctrl && key.name == "r") {
                process.emit("SIGHUP");
            }
        });
    }

    if (WATCH) {
        const watch = require("watch");
        var watchPath = path.dirname(APPFILE);
        var criticalRxp = new RegExp("^(" + path.basename(APPFILE) + "|src\/|models\/|node_modules\/)");
        var assetRxp = new RegExp("^(assets\/|public\/|static\/|views\/)");
        watch.createMonitor(watchPath, function (monitor) {
            console.info("Master: Watching for file system changes.");
            monitor.on("created", function (f, stat) {
            });
            monitor.on("changed", function (f, curr, prev) {
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

    console.info("Master: %s", "Setting up cluster...");

    // Fork workers
    for (var i = 0; i < FORKS; i++) {
        overseer.fork();
    }
};

overseer._restartingWorkers = false;
overseer.on("restartWorkers", function(cb) {
    console.info("Master: Restarting %s workers...", overseer.workers.length);
    if (overseer._restartingWorkers === true) {
        if (typeof cb === "function") {
            cb(false);
        }
        return false;
    }
    var oldWorkers = overseer.workers.slice(0);
    var len = len = oldWorkers.length;
    for (var i = 0; i < len; i++) {
        oldWorkers[i].on("exit", function(){
            var newWorker = overseer.fork();
            if (oldWorkers.length) {
                newWorker.once("listening", function(){
                    oldWorkers.shift().destroy();
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
        FORKS = options.forks;
    }
    if (options.watch) {
        WATCH = options.watch;
    }
    return overseer;
};