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

    async newAsset(stub, args) {
      try {
        ACLPolicy(stub, ['1']); // Available to only producers
        const aid = JSON.parse(args[0]).aid;
        const pid = JSON.parse(args[0]).pid;
        if (!isInputValid([aid, pid])) {
          throw Error('Input is undefined');
        }
        let newAsset = JSON.parse(args[1]);
        const key = stub.createCompositeKey('AST', [aid]);
        const buffer = await stub.getState(key);
        const asset = buffer.toString("utf8");
        if (asset === "") {
          const res = await stub.invokeChaincode('ownership_contract1', ['newAssetOwnership', JSON.stringify({ aid, new_owner: pid })]);
          let payload = res.payload.buffer.toString('utf8');
          payload = JSON.parse(payload.slice(payload.indexOf('{'), payload.lastIndexOf('}') + 1));
          if (payload.error === undefined) {
            newAsset.timestamp = stub.getTxTimestamp().seconds.low;
            await stub.putState(key, Buffer.from(JSON.stringify(newAsset)));
            return Buffer.from(JSON.stringify({ aid }));
          }
        }
        throw Error('Asset already exists');
      } catch (err) {
        return Buffer.from(JSON.stringify({ error: err.message }));
      }
    }

    async transferAsset(stub, args) {
      try {
        ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
        const aid = JSON.parse(args[0]).aid;
        const pid = JSON.parse(args[0]).pid;
        const oid = JSON.parse(args[0]).oid;
        if (!isInputValid([aid, pid, oid])) {
          throw Error('Input is undefined');
        }
        const res = await stub.invokeChaincode('ownership_contract1', ['getCurrentAssetOwner', JSON.stringify({ aid })]);
        let payload = res.payload.buffer.toString('utf8');
        payload = JSON.parse(payload.slice(payload.indexOf('{'), payload.lastIndexOf('}') + 1));
        if (payload.error === undefined) {
          if (payload.owner !== pid) throw Error('Unable to transfer asset due to owner conflict');
          const res = await stub.invokeChaincode('ownership_contract1', ['updateAssetOwnership', JSON.stringify({ aid, new_owner: oid })]);
          payload = res.payload.buffer.toString('utf8');
          payload = JSON.parse(payload.slice(payload.indexOf('{'), payload.lastIndexOf('}') + 1));
          if (payload.error === undefined) {
            const key = stub.createCompositeKey('TRF', [aid]);
            await stub.putState(key, Buffer.from(JSON.stringify({ from: pid, to: oid, timestamp: stub.getTxTimestamp().seconds.low })));
            const res = await stub.invokeChaincode('transport_contract1', ['newPackageLabel', JSON.stringify({ aid, sender: pid, receiver: oid })]);
            payload = res.payload.buffer.toString('utf8');
            payload = JSON.parse(payload.slice(payload.indexOf('{'), payload.lastIndexOf('}') + 1));
            if (payload.error === undefined) return Buffer.from(JSON.stringify({ lid: payload.lid }));
          }
        }
        throw Error(payload.error);
      } catch (err) {
        return Buffer.from(JSON.stringify({ error: err.message }));
      }
    }

    async getAsset(stub, args) {
      try {
        const aid = JSON.parse(args[0]).aid;
        if (!isInputValid([aid])) {
          throw Error('Input is undefined');
        }
        const key = stub.createCompositeKey('AST', [aid]);
        const buffer = await stub.getState(key);
        const asset = buffer.toString("utf8");
        if (asset !== "") {
          return Buffer.from(JSON.stringify(JSON.parse(asset)));
        }
        throw Error('Asset does not exists');
      } catch (err) {
        return Buffer.from(JSON.stringify({ error: err.message }));
      }
    }

    async newAssetEvent(stub, args) {
      try {
        ACLPolicy(stub, ['1', '2']); // Available to only producers and retailers
        const aid = JSON.parse(args[0]).aid;
        if (!isInputValid([aid])) {
          throw Error('Input is undefined');
        }
        let key = stub.createCompositeKey('AST', [aid]);
        const buffer = await stub.getState(key);
        const asset = buffer.toString("utf8");
        if (asset === "") throw Error('Unable to create new Event, Asset does not exists');
        let newEvent = JSON.parse(args[1]);
        key = stub.createCompositeKey('EVNT', [aid]);
        newEvent.timestamp = stub.getTxTimestamp().seconds.low;
        await stub.putState(key, Buffer.from(JSON.stringify(newEvent)));
        stub.setEvent('chainscan-event', Buffer.from(JSON.stringify({ aid, event: newEvent })));
        return Buffer.from(JSON.stringify({}));
      } catch (err) {
        return Buffer.from(JSON.stringify({ error: err.message }));
      }
    }

    async getAssetEvent(stub, args) {
      try {
        const aid = JSON.parse(args[0]).aid;
        if (!isInputValid([aid])) {
          throw Error('Input is undefined');
        }
        const key = stub.createCompositeKey('EVNT', [aid]);
        const buffer = await stub.getState(key);
        const event = buffer.toString("utf8");
        if (event !== "") {
          return Buffer.from(JSON.stringify(JSON.parse(event)));
        }
        throw Error('Event does not exists');
      } catch (err) {
        return Buffer.from(JSON.stringify({ error: err.message }));
      }
    }
}
shim.start(new Chaincode());