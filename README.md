[![Build Status](https://travis-ci.org/mekwall/overseer.png)](https://travis-ci.org/mekwall/overseer)

# overseer
An experimental cluster manager for nodejs

## Features

* Automatic (re)forking of workers based on CPU cores
* Graceful restart and shutdown of workers
* Rolling restarts so there's no downtime
* Unifying `console` output to master process
* Beautiful logging to stdout that makes sense
* Watch for file system changes and restart/inform workers

## Installation

    npm install -g cluster-overseer

## Basic usage

### CLI

    overseer -f 4 app
    
The above will fork 4 workers running `app.js` in the current directory.

### Programmatic

    require('cluster-overseer')('app.js', {
        watch: true
    }).run();
    
The above will fork as many workers as there are CPU cores and restart/inform these on any file system changes.

## Wishlist

* Customizable file system watcher
* Deeper wrapping (sandboxing?) of worker processes
* Ability to override the port and host used when listening
* Customizable logging
* Alternative for `forever`
* Script to run as deamon
* Plugin system

## License

Copyright (c) 2010-2013 Marcus Ekwall

The MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
