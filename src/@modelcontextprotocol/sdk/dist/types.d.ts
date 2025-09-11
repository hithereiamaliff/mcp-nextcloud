import { z, ZodTypeAny } from "zod";
import { Readable, Writable } from "node:stream";
import { IncomingMessage, ServerResponse } from "node:http";

// src/server/auth/types.ts
/**
 * Information about a validated access token, provided to request handlers.
 */
export interface AuthInfo {
  /**
   * The access token.
   */
  token: string;

  /**
   * The client ID associated with this token.
   */
  clientId: string;

  /**
   * Scopes associated with this token.
   */
  scopes: string[];

  /**
   * When the token expires (in seconds since epoch).
   */
  expiresAt?: number;

  /**
   * The RFC 8707 resource server identifier for which this token is valid.
   * If set, this MUST match the MCP server's resource identifier (minus hash fragment).
   */
  resource?: URL;

  /**
   * Additional data associated with the token.
   * This field should be used for any additional data that needs to be attached to the auth info.
  */
  extra?: Record<string, unknown>;
}

// src/types.ts
export const LATEST_PROTOCOL_VERSION = "2025-06-18";
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
export const SUPPORTED_PROTOCOL_VERSIONS: string[];

/* JSON-RPC types */
export const JSONRPC_VERSION = "2.0";

/**
 * A progress token, used to associate progress notifications with the original request.
 */
export type ProgressToken = string | number;

/**
 * An opaque token used to represent a cursor for pagination.
 */
export type Cursor = string;

export interface Request {
    method: string;
    params?: {
        _meta?: {
            progressToken?: ProgressToken;
        };
    };
}

export interface Notification {
    method: string;
    params?: {
        _meta?: object;
    };
}

export interface Result {
    _meta?: object;
}

/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
export type RequestId = string | number;

/**
 * A request that expects a response.
 */
export interface JSONRPCRequest extends Request {
    jsonrpc: "2.0";
    id: RequestId;
}

/**
 * A notification which does not expect a response.
 */
export interface JSONRPCNotification extends Notification {
    jsonrpc: "2.0";
}

/**
 * A successful (non-error) response to a request.
 */
export interface JSONRPCResponse {
    jsonrpc: "2.0";
    id: RequestId;
    result: Result;
}

/**
 * Error codes defined by the JSON-RPC specification.
 */
export enum ErrorCode {
    ConnectionClosed = -32000,
    RequestTimeout = -32001,
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603
}

/**
 * A response to a request that indicates an error occurred.
 */
export interface JSONRPCError {
    jsonrpc: "2.0";
    id: RequestId;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCNotification | JSONRPCResponse | JSONRPCError;

/* Empty result */
/**
 * A response that indicates success but carries no data.
 */
export interface EmptyResult extends Result {
}

/* Cancellation */
/**
 * This notification can be sent by either side to indicate that it is cancelling a previously-issued request.
 */
export interface CancelledNotification extends Notification {
    method: "notifications/cancelled";
    params: {
        requestId: RequestId;
        reason?: string;
    };
}

/* Base Metadata */
/**
 * Base metadata interface for common properties across resources, tools, prompts, and implementations.
 */
export interface BaseMetadata {
    name: string;
    title?: string;
}

/* Initialization */
/**
 * Describes the name and version of an MCP implementation.
 */
export interface Implementation extends BaseMetadata {
    version: string;
}

/**
 * Capabilities a client may support.
 */
export interface ClientCapabilities {
    experimental?: object;
    sampling?: object;
    elicitation?: object;
    roots?: {
        listChanged?: boolean;
    };
}

/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
export interface InitializeRequest extends Request {
    method: "initialize";
    params: {
        protocolVersion: string;
        capabilities: ClientCapabilities;
        clientInfo: Implementation;
    };
}

/**
 * Capabilities that a server may support.
 */
export interface ServerCapabilities {
    experimental?: object;
    logging?: object;
    completions?: object;
    prompts?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    tools?: {
        listChanged?: boolean;
    };
}

/**
 * After receiving an initialize request from the client, the server sends this response.
 */
export interface InitializeResult extends Result {
    protocolVersion: string;
    capabilities: ServerCapabilities;
    serverInfo: Implementation;
    instructions?: string;
}

/**
 * This notification is sent from the client to the server after initialization has finished.
 */
export interface InitializedNotification extends Notification {
    method: "notifications/initialized";
}

/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive.
 */
export interface PingRequest extends Request {
    method: "ping";
}

/* Progress notifications */
export interface Progress {
    progress: number;
    total?: number;
    message?: string;
}

export interface ProgressNotification extends Notification {
    method: "notifications/progress";
    params: Progress & {
        progressToken: ProgressToken;
    };
}

// ... and so on for all the other types ...
// Due to the size of the original types.ts, I am providing a simplified version here.
// A complete implementation would require all the types.

// src/shared/transport.ts
export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Options for sending a JSON-RPC message.
 */
export type TransportSendOptions = {
  /**
   * If present, `relatedRequestId` is used to indicate to the transport which incoming request to associate this outgoing message with.
   */
  relatedRequestId?: RequestId;

  /**
   * The resumption token used to continue long-running requests that were interrupted.
   *
   * This allows clients to reconnect and continue from where they left off, if supported by the transport.
   */
  resumptionToken?: string;

  /**
   * A callback that is invoked when the resumption token changes, if supported by the transport.
   *
   * This allows clients to persist the latest token for potential reconnection.
   */
  onresumptiontoken?: (token: string) => void;
}
/**
 * Describes the minimal contract for a MCP transport that a client or server can communicate over.
 */
export interface Transport {
  /**
   * Starts processing messages on the transport, including any connection steps that might need to be taken.
   */
  start(): Promise<void>;

  /**
   * Sends a JSON-RPC message (request or response).
   */
  send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void>;

  /**
   * Closes the connection.
   */
  close(): Promise<void>;

  /**
   * Callback for when the connection is closed for any reason.
   */
  onclose?: () => void;

  /**
   * Callback for when an error occurs.
   */
  onerror?: (error: Error) => void;

  /**
   * Callback for when a message (request or response) is received over the connection.
   */
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  /**
   * The session ID generated for this connection.
   */
  sessionId?: string;

  /**
   * Sets the protocol version used for the connection (called when the initialize response is received).
   */
  setProtocolVersion?: (version: string) => void;
}

// src/shared/protocol.ts
export type ProgressCallback = (progress: Progress) => void;

export type ProtocolOptions = {
  enforceStrictCapabilities?: boolean;
  debouncedNotificationMethods?: string[];
};

export const DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;

export type RequestOptions = {
  onprogress?: ProgressCallback;
  signal?: AbortSignal;
  timeout?: number;
  resetTimeoutOnProgress?: boolean;
  maxTotalTimeout?: number;
} & TransportSendOptions;

export type NotificationOptions = {
  relatedRequestId?: RequestId;
}

export type RequestHandlerExtra<SendRequestT extends Request,
  SendNotificationT extends Notification> = {
    signal: AbortSignal;
    authInfo?: AuthInfo;
    sessionId?: string;
    _meta?: any;
    requestId: RequestId;
    requestInfo?: any;
    sendNotification: (notification: SendNotificationT) => Promise<void>;
    sendRequest: <U extends z.ZodType<object>>(request: SendRequestT, resultSchema: U, options?: RequestOptions) => Promise<z.infer<U>>;
  };

export abstract class Protocol<
  SendRequestT extends Request,
  SendNotificationT extends Notification,
  SendResultT extends Result,
> {
    constructor(options?: ProtocolOptions);
    connect(transport: Transport): Promise<void>;
    close(): Promise<void>;
    request<T extends z.ZodType<object>>(request: SendRequestT, resultSchema: T, options?: RequestOptions): Promise<z.infer<T>>;
    notification(notification: SendNotificationT, options?: NotificationOptions): Promise<void>;
    setRequestHandler<T extends z.ZodObject<{ method: z.ZodLiteral<string>; }>>(requestSchema: T, handler: (request: z.infer<T>, extra: RequestHandlerExtra<SendRequestT, SendNotificationT>) => SendResultT | Promise<SendResultT>): void;
    setNotificationHandler<T extends z.ZodObject<{ method: z.ZodLiteral<string>; }>>(notificationSchema: T, handler: (notification: z.infer<T>) => void | Promise<void>): void;
}

// src/server/index.ts
export type ServerOptions = ProtocolOptions & {
  capabilities?: ServerCapabilities;
  instructions?: string;
};

export class Server<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends Protocol<
  ServerRequest | RequestT,
  ServerNotification | NotificationT,
  ServerResult | ResultT
> {
    constructor(serverInfo: Implementation, options?: ServerOptions);
    oninitialized?: () => void;
    registerCapabilities(capabilities: ServerCapabilities): void;
    getClientCapabilities(): ClientCapabilities | undefined;
    getClientVersion(): Implementation | undefined;
    ping(): Promise<EmptyResult>;
    createMessage(params: any, options?: RequestOptions): Promise<any>;
    elicitInput(params: any, options?: RequestOptions): Promise<any>;
    listRoots(params?: any, options?: RequestOptions): Promise<any>;
    sendLoggingMessage(params: any, sessionId?: string): Promise<void>;
    sendResourceUpdated(params: any): Promise<void>;
    sendResourceListChanged(): Promise<void>;
    sendToolListChanged(): Promise<void>;
    sendPromptListChanged(): Promise<void>;
    tool(name: string, tool: any): void;
    resource(uri: string, resource: any): void;
    lifespan(callback: () => Promise<() => void>): void;
    start(): void;
}

// src/server/stdio.ts
export class StdioServerTransport implements Transport {
    constructor(stdin?: Readable, stdout?: Writable);
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    start(): Promise<void>;
    close(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
}

export type StreamId = string;
export type EventId = string;

export interface EventStore {
  storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId>;
  replayEventsAfter(lastEventId: EventId, { send }: {
    send: (eventId: EventId, message: JSONRPCMessage) => Promise<void>
  }): Promise<StreamId>;
}

export interface StreamableHTTPServerTransportOptions {
  sessionIdGenerator: (() => string) | undefined;
  onsessioninitialized?: (sessionId: string) => void | Promise<void>;
  onsessionclosed?: (sessionId: string) => void | Promise<void>;
  enableJsonResponse?: boolean;
  eventStore?: EventStore;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  enableDnsRebindingProtection?: boolean;
}

export class StreamableHttpServerTransport implements Transport {
    constructor(options: StreamableHTTPServerTransportOptions);
    handleRequest(req: IncomingMessage & { auth?: AuthInfo }, res: ServerResponse, parsedBody?: unknown): Promise<void>;
    start(): Promise<void>;
    close(): Promise<void>;
    send(message: JSONRPCMessage, options?: { relatedRequestId?: RequestId }): Promise<void>;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
    sessionId?: string;
}

export type Progress = z.infer<typeof ProgressSchema>;
export type Request = z.infer<typeof RequestSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type RequestId = z.infer<typeof RequestIdSchema>;
export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;
export type JSONRPCNotification = z.infer<typeof JSONRPCNotificationSchema>;
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;
export type JSONRPCError = z.infer<typeof JSONRPCErrorSchema>;
export type JSONRPCMessage = z.infer<typeof JSONRPCMessageSchema>;
export type EmptyResult = z.infer<typeof EmptyResultSchema>;
export type CancelledNotification = z.infer<typeof CancelledNotificationSchema>;
export type BaseMetadata = z.infer<typeof BaseMetadataSchema>;
export type Implementation = z.infer<typeof ImplementationSchema>;
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>;
export type InitializeRequest = z.infer<typeof InitializeRequestSchema>;
export type ServerCapabilities = z.infer<typeof ServerCapabilitiesSchema>;
export type InitializeResult = z.infer<typeof InitializeResultSchema>;
export type InitializedNotification = z.infer<typeof InitializedNotificationSchema>;
export type PingRequest = z.infer<typeof PingRequestSchema>;
export type ProgressNotification = z.infer<typeof ProgressNotificationSchema>;
export type ServerRequest = any;
export type ServerNotification = any;
export type ServerResult = any;