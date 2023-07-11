# Autodebug

Autodebug allows you to automatically start debugging sessions when a process starts. This can work with C++, Rust or Python (or really any language with a debugger that can open Unix sockets). It is helpful when the process you want to debug is buried deep within a complex system.

It works like this:

1. When you start a new integrated terminal the extension creates a Unix socket and sets an environment variable in the terminal (`AUTODEBUG_IPC_HANDLE`) with the path of the socket.
2. In your program, YOU add code to read the environment variable and send a debug session command to the Unix socket. An example of how to do this for C/C++ is given in the `c` directory.
3. The extension listens on the socket for JSON debug session descriptions, and starts them.

**SECURITY NOTE**

This extension listens on a Unix socket and executes any debug session configs that are sent to it. Debug sessions can run any program. This should not really matter since anyone that can connect to a Unix socket of the current user can probably run any program anyway, but it is a little icky.

## How To

For C++:

1. Install the CodeLLDB extension.
2. Link your program with `c/vscode_debug.c`.
3. *In the integrated terminal* run `CPP_DEBUG=1 ./my_program`. It should automatically start a debug session.

## Extension Settings

This extension contributes the following settings:

* `autodebug.enable`: Enable/disable this extension.

## Known Issues

* It only works when the program is run from the integrated terminal.

## Release Notes

### 1.0.0

Initial release.
