const shim = require('fabric-shim');
const crypto = require('crypto');

const orgs = {
    '1': 'Producer',
    '2': 'Retailer',
    '3': 'Transportation',
    '4': 'Consumer'
};

function isInputValid(array) {
    for (let i=0; i<array.length; i++) {
      if (array[i] === undefined || array[i] === "") return false;
    }
    return true;
}

function getDigest(string) {
    const md5sum = crypto.createHash('md5');
    md5sum.update(string);
    return md5sum.digest('hex');
}

async function validateOwners(stub, array) {
    for (let i=0; i<array.length; i++) {
        const key = stub.createCompositeKey('OWNR', [array[i]]);
        const buffer = await stub.getState(key);
        const owner = buffer.toString("utf8");
        if (owner === "") throw Error(`Owner "${array[i]}" does not exists`);
    }
}

function ACLPolicy(stub, availableTo) {
    const mspId = stub.getCreator().mspid.match(/\d/g)[0];
    if (availableTo.indexOf(`${mspId}`) === -1) throw Error('Connection blocked by ACL policies');
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

    async newOwner(stub, args) {
        try {
            const newOwner = JSON.parse(args[1]);
            const oid = getDigest(JSON.stringify(newOwner));
            const key = stub.createCompositeKey('OWNR', [oid]);
            const buffer = await stub.getState(key);
            let owner = buffer.toString("utf8");
            if (owner === "") {
                owner = newOwner;
                owner.doctype = orgs[stub.getCreator().mspid[3]].toLowerCase();
                owner.timestamp = stub.getTxTimestamp().seconds.low;
                await stub.putState(key, Buffer.from(JSON.stringify(owner)));
                return Buffer.from(JSON.stringify({ oid }));
            }
            throw Error('Owner already exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async newAssetOwnership(stub, args) {
        try {
            ACLPolicy(stub, ['1']); // Available to only producers
            const aid = JSON.parse(args[0]).aid;
            const newOwner = JSON.parse(args[0]).new_owner;
            if (!isInputValid([aid, newOwner])) {
                throw Error('Input is undefined');
            }
            await validateOwners(stub, [newOwner]);
            const key = stub.createCompositeKey('OWSP', [aid]);
            const buffer = await stub.getState(key);
            const ownership = buffer.toString("utf8");
            if (ownership === "") {
                await stub.putState(key, Buffer.from(JSON.stringify({ owner: newOwner, timestamp: stub.getTxTimestamp().seconds.low })));
                return Buffer.from(JSON.stringify({}));
            } 
            throw Error('Asset Ownership already exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async updateAssetOwnership(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
            const aid = JSON.parse(args[0]).aid;
            const newOwner = JSON.parse(args[0]).new_owner;
            if (!isInputValid([aid, newOwner])) {
                throw Error('Input is undefined');
            }
            await validateOwners(stub, [newOwner]);
            const key = stub.createCompositeKey('OWSP', [aid]);
            const buffer = await stub.getState(key);
            const ownership = buffer.toString("utf8");
            if (ownership !== "") {
                await stub.putState(key, Buffer.from(JSON.stringify({ owner: newOwner, timestamp: stub.getTxTimestamp().seconds.low })));
                return Buffer.from(JSON.stringify({}));
            } 
            throw Error('Asset Ownershipt does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async getCurrentAssetOwner(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
            const aid = JSON.parse(args[0]).aid;
            if (!isInputValid([aid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('OWSP', [aid]);
            const buffer = await stub.getState(key);
            const ownership = buffer.toString("utf8");
            if (ownership !== "") {
                return Buffer.from(JSON.stringify(JSON.parse(ownership)));
            }
            throw Error('Asset Ownership does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }

    async getHistoricalAssetOwnership(stub, args) {
        try {
            const aid = JSON.parse(args[0]).aid;
            if (!isInputValid([aid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('OWSP', [aid]);
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

    async getOwnerEmailContact(stub, args) {
        try {
            ACLPolicy(stub, ['1', '2']); // Available only to producers and retailers
            const oid = JSON.parse(args[0]).oid;
            if (!isInputValid([oid])) {
                throw Error('Input is undefined');
            }
            const key = stub.createCompositeKey('OWNR', [oid]);
            const buffer = await stub.getState(key);
            const owner = buffer.toString("utf8");
            if (owner !== "") {
                return Buffer.from(JSON.stringify({ email: JSON.parse(owner).contact_email }));
            }
            throw Error('Owner does not exists');
        } catch (err) {
            return Buffer.from(JSON.stringify({ error: err.message }));
        }
    }
}
shim.start(new Chaincode());