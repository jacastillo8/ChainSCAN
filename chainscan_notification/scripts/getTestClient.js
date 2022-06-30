require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const host = 'localhost';
const port = 4000;
const bid = "ea923f759f5a76318801cd4b781d28a3d9910fde";

let org = 'Producer';
let user = 'producer_user';

async function downloadClient(org, user) {
    try {
        let ccp = await axios.get(`http://${host}:${port}/api/${bid}/config/${org}`); 
        let wallet = await axios.get(`http://${host}:${port}/api/${bid}/wallet/${user}/${org}`); 
        
        wallet = wallet.data;
        ccp = ccp.data;
        for (let i=0; i<Object.keys(ccp.peers).length; i++) {
            let key = Object.keys(ccp.peers)[i];
            let peer = ccp.peers[key]
            ccp.peers[key].url = peer.url.replace('localhost', host)
        }
        let key = Object.keys(ccp.certificateAuthorities)[0];
        ccp.certificateAuthorities[key].url = ccp.certificateAuthorities[key].url.replace('localhost', host);
        fs.writeFileSync(`./ccp/connection-${org}.json`, JSON.stringify(ccp, null, 2));
        fs.writeFileSync(`./wallet/${user}.id`, JSON.stringify(wallet));
    }
    catch (err) {
        console.log(err.message);
    }
}

downloadClient(org, user);