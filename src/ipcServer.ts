// Based on VSCode's `extensions/git/src/ipc/ipcServer.ts` 293e46b36015307d159b3ea38ec8dbe534be9c76
// Copyright Microsoft, used under MIT license.

import { Disposable, debug, window } from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as net from "net";
import * as crypto from "crypto";
import { ITerminalEnvironmentProvider } from "./terminal";


function getIPCHandlePath(id: string): string {
	if (process.platform === "win32") {
		return `\\\\.\\pipe\\autodebug-${id}-sock`;
	}

	if (process.platform !== "darwin" && process.env["XDG_RUNTIME_DIR"]) {
		return path.join(process.env["XDG_RUNTIME_DIR"] as string, `autodebug-${id}.sock`);
	}

	return path.join(os.tmpdir(), `autodebug-${id}.sock`);
}

// `context` is fed into a hash to make the random IPC socket name.
export async function createIPCServer(context?: string): Promise<IPCServer> {
	const server = net.createServer();
	const hash = crypto.createHash("sha1");

	if (!context) {
		console.warn("No context given to autodebug");
		const buffer = await new Promise<Buffer>((c, e) => crypto.randomBytes(20, (err, buf) => err ? e(err) : c(buf)));
		hash.update(buffer);
	} else {
		hash.update(context);
	}

	const ipcHandlePath = getIPCHandlePath(hash.digest("hex").substr(0, 10));

	if (process.platform !== "win32") {
		try {
			await fs.promises.unlink(ipcHandlePath);
		} catch {
			// noop
		}
	}

	return new Promise((c, e) => {
		try {
			server.on("error", err => e(err));
			server.listen(ipcHandlePath);
			c(new IPCServer(server, ipcHandlePath));
		} catch (err) {
			e(err);
		}
	});
}

class IPCConnection {
	private pendingData: string = "";

	constructor(private socket: net.Socket) {
		this.socket.addListener("data", data => this.onData(data));
		this.socket.addListener("error", err => {
			window.showErrorMessage(`Autodebug connection error: ${err}`);
		});
	}

	private onData(data: Buffer): void {
		const dataStr = data.toString("utf8");
		this.pendingData += dataStr;
		const newline = this.pendingData.indexOf("\n");
		if (newline !== -1) {
			const req = this.pendingData.slice(0, newline);
			this.pendingData = this.pendingData.slice(newline+1);
			this.onRequest(req);
		}
	}

	private onRequest(req: string): void {
		console.log(`autodebug request: ${req}`);
		try {
			const config = JSON.parse(req);
			debug.startDebugging(undefined, config);
		} catch (e) {
			window.showErrorMessage(`Autodebug error starting session: ${e}`);
		}
	}
}

export class IPCServer implements ITerminalEnvironmentProvider, Disposable {

	private clients: Set<IPCConnection> = new Set();
	get ipcHandlePath(): string { return this._ipcHandlePath; }

	constructor(private server: net.Server, private _ipcHandlePath: string) {
		this.server.on("connection", socket => this.onConnection(socket));
	}

	private onConnection(socket: net.Socket): void {
		console.log("autodebug connection");
		const connection = new IPCConnection(socket);
		this.clients.add(connection);
		socket.addListener("close", () => {
			this.clients.delete(connection);
		});
	}

	getTerminalEnv(): { [key: string]: string } {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		return { AUTODEBUG_IPC_HANDLE: this.ipcHandlePath };
	}

	dispose(): void {
		this.clients.clear();
		this.server.close();

		if (this._ipcHandlePath && process.platform !== "win32") {
			fs.unlinkSync(this._ipcHandlePath);
		}
	}
}
