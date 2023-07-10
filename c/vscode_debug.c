#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/un.h>

__attribute__((constructor))
static void vscode_debug_send_pid() {
    // Get the Unix socket path to connect to.
    const char* handle = getenv("AUTODEBUG_IPC_HANDLE");
    if (!handle) {
        return;
    }

    // Create a socket.
    int sfd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (sfd == -1) {
        perror("creating socket");
        return;
    }

    // Connect to the socket.
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(struct sockaddr_un));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, handle, sizeof(addr.sun_path) - 1);

    int rc = connect(sfd, (struct sockaddr *) &addr, sizeof(struct sockaddr_un));
    if (rc == -1) {
        perror("connecting to autodebug socket");
        return;
    }

    char buffer[1024];
    int len = snprintf(buffer, sizeof(buffer), "{ pid: %d }\n", getpid());
    if (len >= sizeof(buffer)) {
        // It was truncated and there's no null byte.
        // TODO: Print error.
        return;
    }

    // Write out PID.
    int written = write(sfd, buffer, len);
    if (written == -1) {
        perror("writing to autodebug socket");
        return;
    }
    if (written != len) {
        // Interrupted due to e.g. signal.
        // TODO: Handle this & resume.
        // TODO: Print error.
        return;
    }

    close(sfd);
}
