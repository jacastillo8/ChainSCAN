const path = require('path')
const { ChainSCANClient } = require('../middleware/client');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/*********************************** 
 ** Blockchain Client Information ** 
 ***********************************/
let channel = 'channelone';

let org = 'Producer';
let user = 'producer_user';
let contract1 = 'asset_contract1';
let contract2 = 'ownership_contract1';

let oauth_password = process.env.PASSWORD;
let sender = process.env.SENDER;

async function main() {
    let client = new ChainSCANClient({ org, user, channel, contract1, contract2 }, sender)
    await client.connect();
    client.setUpMail(oauth_password);
    await client.listen()
}

main();