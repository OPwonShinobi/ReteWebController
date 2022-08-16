export const nodeDataCache = {
  chainingData: {},
  cacheChainingValue(node, key, val) {
    const childCount = getOutputChildCount(node, key);
    this.cacheValueWithChildCount(node, val, childCount);
  },

  //bypass caching logic, just shove value into cache
  cacheValueWithChildCount(node, val, childCount) {
    if (childCount) {
      if (!this.chainingData[node.id]) {
        this.chainingData[node.id] = {fifo: []};
      }
      this.chainingData[node.id].fifo.push({childCount: childCount, data: val});
    }
  },

  popParentNodeCache(node) {
    //node saves child node id in "node" field, not id field
    const parentId = node.inputs["dat"].connections[0].node;
    return this.popSingleParentCache(parentId);
  },

  popMultiParentNodeCache(node) {
    let cacheData = null;
    //popParentNodeCache with many potential parents
    for(const key in node.inputs) {
      const inputConns = node.inputs[key].connections;
      if (inputConns.length) {
        const parentId = inputConns[0].node;
        cacheData = this.popSingleParentCache(parentId);
        if (cacheData != null) break;
      }
    }
    return cacheData;
  },

  popSingleParentCache(parentId) {
    let cacheData = null;
    if (this.chainingData[parentId] != null) {
      if (this.chainingData[parentId].fifo) {
        cacheData = this.popFifoObj(parentId);
      }
    }
    return cacheData;
  },

  popFifoObj(parentId) {
    const fifoElem = this.chainingData[parentId].fifo[0];
    const cacheData = fifoElem.data;
    fifoElem.childCount--;
    if (fifoElem.childCount <= 0) {
      this.chainingData[parentId].fifo.shift();
    }
    if (this.chainingData[parentId].fifo.length <= 0) {
      delete this.chainingData[parentId];
    }
    return cacheData;
  }
};


// Create WebSocket connection. Note this runs in App, but is separate from main server
// Connection closes by itself on page refresh. No need to clean up
class WebSockType {
  static BROADCAST = "broadcast";
  static HTTP = "http";
  static INVALID = "err";
}
//rete worker scope cant access these unless made part of document body
document.WebSockType = WebSockType;
class WebSockFields {
  static TYPE = "type";
  static NAME = "name";
  static PAYLOAD = "payload";
  static ENDPOINT = "endpoint";
}
document.WebSockFields = WebSockFields;

export const eventListenerCache = {
  listeners: new Map(),
  addListener(id, name, handler) {
    if (this.listeners.get(id)) {
      this.removeListener(id);
    }
    document.addEventListener(name, handler, false);
    this.listeners.set(id, {name: name, handler: handler});
  },
  removeListener(id) {
    if (this.listeners.get(id)) {
      const listener = this.listeners.get(id);
      document.removeEventListener(listener.name, listener.handler);
      this.listeners.delete(id);
    }
  }
};

var WEB_SOCK_PORT = 0;
export async function loadWebSockSettings() {
  await fetch("/config?type=setting&name=ws_port")
  .then(rsp => rsp.json())
  .then(port =>
    WEB_SOCK_PORT = port
  );
}
//client-side-only ws socket cache. Sockets are untracked on server side
export const wsSocketCache = {
  sockets: new Map(),
  addConnection(nodeId) {
    let wsSocket = this.sockets.get(nodeId);
    if (!wsSocket) {
      wsSocket = new WebSocket('ws://localhost:' + WEB_SOCK_PORT);
      this.sockets.set(nodeId, wsSocket);
    }
    return wsSocket;
  },
  closeConnection(nodeId) {
    this.sockets.get(nodeId).close();
    this.sockets.delete(nodeId);
  },
  getConnection(nodeId) {
    return this.sockets.get(nodeId);
  }
};


export function getOutputChildCount(node, key) {
  return node.outputs[key].connections.length;
}
export function sendHttpReq(socket, data, endpointData) {
  const req = {};
  req[WebSockFields.TYPE] = WebSockType.HTTP;
  req[WebSockFields.ENDPOINT] = JSON.parse(endpointData);//backend needs this as json
  req[WebSockFields.PAYLOAD] = data;
  socket.send(JSON.stringify(req));
}

export function runCustomCode(funcStr, inputData) {
//funcStr can be null, new Function still runs
  const func = new Function("$INPUT", funcStr);
  let outputData = null;
  try {outputData = func(inputData);}
  catch (e) {
    outputData = e;
  }
  return outputData;
}
