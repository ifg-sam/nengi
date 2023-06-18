"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserConnectionState = exports.User = void 0;
var UserConnectionState;
(function (UserConnectionState) {
    UserConnectionState[UserConnectionState["NULL"] = 0] = "NULL";
    UserConnectionState[UserConnectionState["OpenPreHandshake"] = 1] = "OpenPreHandshake";
    UserConnectionState[UserConnectionState["OpenAwaitingHandshake"] = 2] = "OpenAwaitingHandshake";
    UserConnectionState[UserConnectionState["Open"] = 3] = "Open";
    UserConnectionState[UserConnectionState["Closed"] = 4] = "Closed";
})(UserConnectionState || (UserConnectionState = {}));
exports.UserConnectionState = UserConnectionState;
class User {
    constructor(socket, networkAdapter) {
        this.id = 0;
        this.socket = socket;
        this.instance = null;
        this.networkAdapter = networkAdapter;
        this.network = null;
        this.remoteAddress = null;
        this.connectionState = UserConnectionState.NULL;
        this.subscriptions = new Map();
        this.engineMessageQueue = [];
        this.messageQueue = [];
        this.responseQueue = [];
        this.cache = {};
        this.cacheArr = [];
    }
    subscribe(channel) {
        this.subscriptions.set(channel.id, channel);
    }
    unsubscribe(channel) {
        this.subscriptions.delete(channel.id);
    }
    queueEngineMessage(engineMessage) {
        this.engineMessageQueue.push(engineMessage);
    }
    queueMessage(message) {
        this.messageQueue.push(message);
    }
    createOrUpdate(id, tick, toCreate, toUpdate) {
        if (!this.cache[id]) {
            //console.log('create push', id)
            toCreate.push(id);
            this.cache[id] = tick;
            this.cacheArr.push(id);
        }
        else {
            this.cache[id] = tick;
            toUpdate.push(id);
        }
        const children = this.instance.localState.parents.get(id);
        if (children) {
            children.forEach((id) => this.createOrUpdate(id, tick, toCreate, toUpdate));
        }
    }
    send(buffer) {
        this.networkAdapter.send(this, buffer);
    }
    disconnect(reason) {
        try {
            this.networkAdapter.disconnect(this, reason);
        }
        catch (e) {
            console.log("error in disconnect. ignoring as its likely the stupid hacker", e);
        }
    }
    checkVisibility(tick) {
        const toCreate = [];
        const toUpdate = [];
        const toDelete = [];
        this.subscriptions.forEach((channel) => {
            channel.getVisible(this.id).forEach((nid) => {
                this.createOrUpdate(nid, tick, toCreate, toUpdate);
            });
        });
        for (let i = this.cacheArr.length - 1; i > -1; i--) {
            const id = this.cacheArr[i];
            if (this.cache[id] !== tick) {
                //console.log('delete', id)
                toDelete.push(id);
                this.cache[id] = 0;
                //delete this.cache[id]
                this.cacheArr.splice(i, 1);
            }
        }
        return {
            //events: nearby.events,
            noLongerVisible: toDelete,
            stillVisible: toUpdate,
            newlyVisible: toCreate, //diffs.bOnly
        };
    }
}
exports.User = User;
//# sourceMappingURL=User.js.map