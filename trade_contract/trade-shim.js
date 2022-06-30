const shim = require('fabric-shim');

function isInputValid(array) {
    for (let i=0; i<array.length; i++) {
      if (array[i] === undefined || array[i] === "") return false;
    }
    return true;
}

function ACLPolicy(stub, availableTo) {
    const mspId = stub.getCreator().mspid.match(/\d/g)[0];
    if (availableTo.indexOf(`${mspId}`) === -1) throw Error('Connection blocked by ACL policies')
}

var Chaincode = class {

    async Init(stub) {
        return shim.success();
    }
  
    async Invoke(stub) {
        try {
            const ret = stub.getFunctionAndParameters();
            const method = this[ret.fcn];
            if (method === undefined) throw Error('Method does not exists');
            const payload = await method(stub, ret.params);
            return shim.success(payload);
        } catch (err) {
            return shim.error(err);
        }
    }

    async newTradeOrder(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2', '3']); // Available to only producers, retailers and transportation
            const aid = JSON.parse(args[0]).aid;
            const newOwner = JSON.parse(args[0]).new_owner;
            if (!isInputValid([aid, newOwner])) {
                throw Error('Input is undefined');
            }
            const res = await stub.invokeChaincode('ownership_contract1', ['getCurrentAssetOwner', JSON.stringify({ aid })]);
            let payload = res.payload.buffer.toString('utf8');
            payload = JSON.parse(payload.slice(payload.indexOf('{'), payload.lastIndexOf('}') + 1));
            if (payload.error === undefined) {
                const currentOwner = payload.owner;
                const key = stub.createCompositeKey('TRD', [currentOwner]);
                await stub.putState(key, Buffer.from(JSON.stringify({ aid, from: currentOwner, to: newOwner, timestamp: stub.getTxTimestamp().seconds.low })));
                return Buffer.from(JSON.stringify({}));
            }
            throw Error(payload.error);
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async getTradeOrder(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
            const oid = JSON.parse(args[0]).oid;
            if (!isInputValid([oid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('TRD', [oid]);
            const buffer = await stub.getState(key);
            const order = buffer.toString('utf8');
            if (order !== "") return Buffer.from(JSON.stringify(JSON.parse(order)));
            throw Error('Trade Order does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async getTradeOrders(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
            const oid = JSON.parse(args[0]).oid;
            if (!isInputValid([oid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('TRD', [oid]);
            const iterator = await stub.getHistoryForKey(key);
            let results = [];
            while (true) {
                const res = await iterator.next();
                if (res.value && res.value.value.toString()) {
                    let record;
                    try {
                        record = JSON.parse(res.value.value.toString("utf8"));
                    } catch (error) {
                        record = res.value.value.toString("utf8");
                    }
                    results.push(record);
                }
                if (res.done) {
                    await iterator.close();
                    return Buffer.from(JSON.stringify(results));
                }
            }
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }
}
shim.start(new Chaincode());