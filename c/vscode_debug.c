#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/un.h>

__attribute__((constructor))
static void vscode_debug_send_pid() {
    // If debugging is enabled. This is so you can just permanently link this.
    const char* enable = getenv("CPP_DEBUG");
    if (!enable) {
        return;
    }

    // Get the Unix socket path to connect to.
    const char* handle = getenv("AUTODEBUG_IPC_HANDLE");
    if (!handle) {
        fprintf(stderr, "autodebug: socket path not set; there should be a AUTODEBUG_IPC_HANDLE env var - try restarting the terminal\n");
        return;
    }

    fprintf(stderr, "autodebug: starting debug session\n");

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
    strncpy(addr.sun_path, handle, sizeof(addr.sun_path));
    if (addr.sun_path[sizeof(addr.sun_path)-1] != '\0') {
        fprintf(stderr, "autodebug: socket path too long\n");
        return;
    }

    int rc = connect(sfd, (struct sockaddr *) &addr, sizeof(struct sockaddr_un));
    if (rc == -1) {
        perror("connecting to autodebug socket");
        return;
    }

    char buffer[1024];
    int len = snprintf(buffer, sizeof(buffer), "{ \"type\": \"lldb\", \"request\": \"attach\", \"pid\": %d }\n", getpid());
    if (len >= sizeof(buffer)) {
        // It was truncated and there's no null byte.
        fprintf(stderr, "autodebug: debug config setup failed\n");
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
        fprintf(stderr, "autodebug: write to VSCode interrupted\n");
        return;
    }

    close(sfd);
}
