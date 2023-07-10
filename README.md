# Autodebug

Autodebug allows you to automatically start debugging sessions when a process starts. This can work with C++ or Python and is helpful when the process you want to debug is buried deep within some weird build system.

It works like this:

1. When you start a new integrated terminal it creates a Unix socket and sets an environment variable with the path of the socket.
2. In your program, YOU add code to read the environment variable and send a debug session command to the Unix socket.
3. The extension starts the debug session.

## Features

TODO: Animation of it working.

## Extension Settings

This extension contributes the following settings:

* `autodebug.enable`: Enable/disable this extension.

## Known Issues

None. It's perfect.

## Release Notes

### 1.0.0

Initial release.
