/// <reference types="node" />
import { Instance } from "./Instance";
import { NetworkEvent } from "../common/binary/NetworkEvent";
import { User } from "./User";
interface INetworkEvent {
    type: NetworkEvent;
    user: User;
    command?: any;
}
declare class InstanceNetwork {
    instance: Instance;
    constructor(instance: Instance);
    onRequest(): void;
    onOpen(user: User): void;
    onCommand(user: User, command: any): void;
    onHandshake(user: User, handshake: any): Promise<void>;
    onMessage(user: User, buffer: Buffer | ArrayBuffer): void;
    onConnectionAccepted(user: User, payload: any): void;
    onConnectionDenied(user: User, payload: any): void;
    onClose(user: User): void;
}
export { InstanceNetwork, INetworkEvent };
