// Module dependencies
const clc = require("cli-color");

var logger = {};

logger.timestamp = function(ret) {
    var date = (new Date);
    var seconds = ""+date.getSeconds();
    var minutes = ""+date.getMinutes();
    var hours = ""+date.getHours();

    if (hours.length === 1) {
        hours = "0" + hours;
    }

    if (minutes.length === 1) {
        minutes = "0" + minutes;
    }

    if (seconds.length === 1) {
        seconds = "0" + seconds;
    }

    if (ret) {
        return { hours: hours, minutes: minutes, seconds: seconds };
    } else {
        process.stdout.write(" "+hours+":"+minutes+" ");
    }
}

logger.log = function () {
    this.timestamp();
    process.stdout.write(clc.white(" log     "));
    if (this._org && this._org.log) {
        this._org.log.apply(this, arguments);
    } else {
        console.log.apply(console, arguments);
    }
};

logger.error = function () {
    this.timestamp();
    process.stdout.write(clc.red.bold(" error   "));
    if (this._org && this._org.error) {
        this._org.error.apply(this, arguments);
    } else {
        console.error.apply(console, arguments);
    }
};

logger.info = function () {
    this.timestamp();
    process.stdout.write(clc.cyan(" info    "));
    if (this._org && this._org.warn) {
        this._org.info.apply(this, arguments);
    } else {
        console.info.apply(console, arguments);
    }
};

logger.warn = function () {
    this.timestamp();
    process.stdout.write(clc.yellow(" warn    "));
    if (this._org && this._org.warn) {
        this._org.warn.apply(this, arguments);
    } else {
        console.warn.apply(console, arguments);
    }
};

logger.debug = function () {
    this.timestamp();
    process.stdout.write(clc.yellow.bold(" debug   "));
    if (this._org && this._org.log) {
        this._org.log.apply(this, arguments);
    } else {
        console.log.apply(console, arguments);
    }
};

module.exports = function (org) {
    if (org) {
        org._org = {
            log: org.log,
            error: org.error,
            info: org.info,
            warn: org.warn
        };
        org._restore = function () {
            for (var fn in org._org) {
                org[fn] = org._org[f];
            }
            delete org._org;
            delete org._restore;
        }

        for (var fn in logger) {
            org[fn] = logger[fn];
        }
        return org;
    }
    return logger;
}