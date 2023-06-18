"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceNetwork = void 0;
const NetworkEvent_1 = require("../common/binary/NetworkEvent");
const User_1 = require("./User");
const BinarySection_1 = require("../common/binary/BinarySection");
const EngineMessage_1 = require("../common/EngineMessage");
const readEngineMessage_1 = __importDefault(require("../binary/message/readEngineMessage"));
const readMessage_1 = __importDefault(require("../binary/message/readMessage"));
class InstanceNetwork {
    constructor(instance) {
        this.instance = instance;
    }
    onRequest() {
        // TODO
    }
    onOpen(user) {
        try {
            user.connectionState = User_1.UserConnectionState.OpenPreHandshake;
            user.network = this;
        }
        catch (e) {
            console.log("error in onCommand. ignoring as its likely the stupid hacker. disconnecting them", e);
            user.disconnect("invalid");
        }
    }
    onCommand(user, command) {
        try {
            this.instance.queue.enqueue({
                type: NetworkEvent_1.NetworkEvent.Command,
                user,
                command,
            });
        }
        catch (e) {
            console.log("error in onCommand. ignoring as its likely the stupid hacker. disconnecting them", e);
            user.disconnect("invalid");
        }
    }
    onHandshake(user, handshake) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                try {
                    user.connectionState = User_1.UserConnectionState.OpenAwaitingHandshake;
                    const connectionAccepted = yield this.instance.onConnect(handshake);
                    // @ts-ignore ts is wrong that this is always false; the value can change during the
                    // above await
                    if (user.connectionState === User_1.UserConnectionState.Closed) {
                        throw new Error("Connection closed before handshake completed.");
                    }
                    user.connectionState = User_1.UserConnectionState.Open;
                    // allow
                    const bw = user.networkAdapter.createBufferWriter(3);
                    bw.writeUInt8(BinarySection_1.BinarySection.EngineMessages);
                    bw.writeUInt8(1);
                    bw.writeUInt8(EngineMessage_1.EngineMessage.ConnectionAccepted);
                    user.send(bw.buffer);
                    user.instance = this.instance;
                    this.onConnectionAccepted(user, connectionAccepted);
                }
                catch (err) {
                    //console.log('Handshake catch block', { err, ws: user.socket, foo: user.connectionState })
                    this.onConnectionDenied(user, err);
                    // NOTE: we are keeping the code between these cases duplicated
                    // if these do turn out to be identical in production we will clean it up
                    // but for now I am suspicious that there will be different logic
                    // in each of these later
                    if (user.connectionState === User_1.UserConnectionState.OpenAwaitingHandshake) {
                        // developer's code decided to reject this connection (rejected promise)
                        const jsonErr = JSON.stringify(err);
                        const denyReasonByteLength = Buffer.byteLength(jsonErr, "utf8");
                        // deny and send reason
                        const bw = user.networkAdapter.createBufferWriter(3 +
                            4 /* string length 32 bits */ +
                            denyReasonByteLength /* length of actual string*/);
                        //binaryWriterCtor.create(3 + 4 /* string length 32 bits */ + denyReasonByteLength /* length of actual string*/)
                        bw.writeUInt8(BinarySection_1.BinarySection.EngineMessages);
                        bw.writeUInt8(1);
                        bw.writeUInt8(EngineMessage_1.EngineMessage.ConnectionDenied);
                        bw.writeString(jsonErr);
                        user.send(bw.buffer);
                    }
                    if (user.connectionState === User_1.UserConnectionState.Open) {
                        // a loss of connection after handshake is complete
                        const jsonErr = JSON.stringify(err);
                        const denyReasonByteLength = Buffer.byteLength(jsonErr, "utf8");
                        // deny and send reason
                        // @ts-ignore
                        const bw = user.networkAdapter.createBufferWriter(3 +
                            4 /* string length 32 bits */ +
                            denyReasonByteLength /* length of actual string*/);
                        bw.writeUInt8(BinarySection_1.BinarySection.EngineMessages);
                        bw.writeUInt8(1);
                        bw.writeUInt8(EngineMessage_1.EngineMessage.ConnectionDenied);
                        bw.writeString(jsonErr);
                        user.send(bw.buffer);
                    }
                }
            }
            catch (e) {
                console.log("error in onHandshake. ignoring as its likely the stupid hacker. disconnecting them", e);
                user.disconnect("invalid");
            }
        });
    }
    onMessage(user, buffer) {
        try {
            const binaryReader = user.networkAdapter.createBufferReader(buffer);
            while (binaryReader.offset < binaryReader.byteLength) {
                const section = binaryReader.readUInt8();
                switch (section) {
                    case BinarySection_1.BinarySection.EngineMessages: {
                        const count = binaryReader.readUInt8();
                        for (let i = 0; i < count; i++) {
                            const type = binaryReader.readUInt8();
                            if (type === EngineMessage_1.EngineMessage.ConnectionAttempt) {
                                const msg = (0, readEngineMessage_1.default)(binaryReader, this.instance.context);
                                const handshake = JSON.parse(msg.handshake);
                                this.onHandshake(user, handshake);
                            }
                        }
                        break;
                    }
                    case BinarySection_1.BinarySection.Commands: {
                        const count = binaryReader.readUInt8();
                        for (let i = 0; i < count; i++) {
                            const msg = (0, readMessage_1.default)(binaryReader, this.instance.context);
                            this.onCommand(user, msg);
                        }
                        break;
                    }
                    case BinarySection_1.BinarySection.Requests: {
                        const count = binaryReader.readUInt8();
                        for (let i = 0; i < count; i++) {
                            const requestId = binaryReader.readUInt32();
                            const endpoint = binaryReader.readUInt32();
                            const str = binaryReader.readString();
                            const body = JSON.parse(str);
                            const cb = this.instance.responseEndPoints.get(endpoint);
                            if (cb) {
                                cb({ user, body }, (response) => {
                                    console.log("supposed to response with", response);
                                    user.responseQueue.push({
                                        requestId,
                                        response: JSON.stringify(response),
                                    });
                                });
                            }
                        }
                        break;
                    }
                    default: {
                        console.log("network hit default case while reading; likely the hacker");
                        user.disconnect("invalid");
                        break;
                    }
                }
            }
        }
        catch (e) {
            console.log("error in onMessage. ignoring as its likely the stupid hacker. disconnecting them", e);
            user.disconnect("invalid");
        }
    }
    onConnectionAccepted(user, payload) {
        try {
            user.network = this;
            user.id = ++this.instance.incrementalUserId;
            this.instance.users.set(user.id, user);
            this.instance.queue.enqueue({
                type: NetworkEvent_1.NetworkEvent.UserConnected,
                user,
                payload,
            });
        }
        catch (e) {
            console.log("error in onConnectionAccepted. ignoring as its likely the stupid hacker. disconnecting them", e);
            user.disconnect("invalid");
        }
    }
    onConnectionDenied(user, payload) {
        try {
            this.instance.queue.enqueue({
                type: NetworkEvent_1.NetworkEvent.UserConnectionDenied,
                user,
                payload,
            });
        }
        catch (e) {
            console.log("error in onConnectionDenied. ignoring as its likely the stupid hacker. disconnecting them", e);
            user.disconnect("invalid");
        }
    }
    onClose(user) {
        try {
            if (user.connectionState === User_1.UserConnectionState.Open) {
                this.instance.queue.enqueue({
                    type: NetworkEvent_1.NetworkEvent.UserDisconnected,
                    user,
                });
                this.instance.users.delete(user.id);
            }
            user.connectionState = User_1.UserConnectionState.Closed;
        }
        catch (e) {
            console.log("error in onClose. ignoring as its likely the stupid hacker. disconnecting them", e);
            user.disconnect("invalid");
        }
    }
}
exports.InstanceNetwork = InstanceNetwork;
//# sourceMappingURL=InstanceNetwork.js.map