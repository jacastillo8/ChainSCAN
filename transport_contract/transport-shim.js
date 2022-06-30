const shim = require('fabric-shim');
const crypto = require('crypto');

function isInputValid(array) {
    for (let i=0; i<array.length; i++) {
      if (array[i] === undefined || array[i] === "") return false;
    }
    return true;
}

function getDigest(string) {
    let md5sum = crypto.createHash('md5');
    md5sum.update(string);
    return md5sum.digest('hex');
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

    async newPackageLabel(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
            const aid = JSON.parse(args[0]).aid;
            const sender = JSON.parse(args[0]).sender;
            const receiver = JSON.parse(args[0]).receiver;
            if (!isInputValid([aid, sender, receiver])) {
              throw Error('Input is undefined');
            }
            const lid = getDigest(JSON.stringify({ aid, sender, receiver }));
            const key = stub.createCompositeKey('SLBL', [lid]);
            const buffer = await stub.getState(key);
            const label = buffer.toString("utf8");
            if (label === "") {
                await stub.putState(key, Buffer.from(JSON.stringify({ received: false, delivered: false, transport_id: "", timestamp: stub.getTxTimestamp().seconds.low })));
                return Buffer.from(JSON.stringify({ lid }));
            }
            throw Error('Package label exists already');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async processPackageLabel(stub, args) {
        try {
            ACLPolicy(stub, ['3']); // Available only to transportation
            const lid = JSON.parse(args[0]).lid;
            const tid = JSON.parse(args[0]).tid;
            if (!isInputValid([lid, tid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('SLBL', [lid]);
            const buffer = await stub.getState(key);
            let label = buffer.toString("utf8");
            if (label !== "") {
                label = JSON.parse(label);
                label.received = true;
                label.transport_id = tid;
                label.timestamp = stub.getTxTimestamp().seconds.low;
                await stub.putState(key, Buffer.from(JSON.stringify(label)));
                return Buffer.from(JSON.stringify({}));
            }
            throw Error('Package label does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async terminatePackageLabel(stub, args) {
        try {
            ACLPolicy(stub, ['3']); // Available only to transportation
            const lid = JSON.parse(args[0]).lid;
            if (!isInputValid([lid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('SLBL', [lid]);
            const buffer = await stub.getState(key);
            let label = buffer.toString("utf8");
            if (label !== "") {
                label = JSON.parse(label);
                if (!label.received) throw Error('Package label not processed');
                label.delivered = true;
                label.timestamp = stub.getTxTimestamp().seconds.low;
                await stub.putState(key, Buffer.from(JSON.stringify(label)));
                return Buffer.from(JSON.stringify({}));
            }
            throw Error('Package label does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async updatePackageLocation(stub, args) {
        try {
            ACLPolicy(stub, ['3']); // Available only to transportation
            const lid = JSON.parse(args[0]).lid;
            if (!isInputValid([lid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('SLBL', [lid]);
            const buffer = await stub.getState(key);
            let label = buffer.toString("utf8");
            if (label !== "") {
                label = JSON.parse(label);
                if (!label.received) throw Error('Package label not processed');
                let loc = JSON.parse(args[1]);
                const key = stub.createCompositeKey('LCTN', [lid]);
                loc.timestamp = stub.getTxTimestamp().seconds.low;
                await stub.putState(key, Buffer.from(JSON.stringify(loc)));
                return Buffer.from(JSON.stringify({}));
            }
            throw Error('Package label does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async getPackageLatest(stub, args) {
        try {
            const lid = JSON.parse(args[0]).lid;
            if (!isInputValid([lid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('SLBL', [lid]);
            const buffer = await stub.getState(key);
            let label = buffer.toString("utf8");
            if (label !== "") {
                label = JSON.parse(label);
                if (!label.received) throw Error('Package label not processed');
                const key = stub.createCompositeKey('LCTN', [lid]);
                const buffer = await stub.getState(key);
                const loc = buffer.toString('utf8');
                if (loc !== "") {
                    return Buffer.from(JSON.stringify(JSON.parse(loc)));
                }
                throw Error('Package Location not available');
            }
            throw Error('Package label does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async getPackageHistory(stub, args) {
        try {
            const lid = JSON.parse(args[0]).lid;
            if (!isInputValid([lid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('SLBL', [lid]);
            const buffer = await stub.getState(key);
            let label = buffer.toString("utf8");
            if (label !== "") {
                label = JSON.parse(label);
                if (!label.received) throw Error('Package label not processed');
                const key = stub.createCompositeKey('LCTN', [lid]);
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
            }
            throw Error('Package label does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }
}
shim.start(new Chaincode());