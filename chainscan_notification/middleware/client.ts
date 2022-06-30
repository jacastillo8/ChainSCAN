'use strict'
const path = require('path');
const fs = require('fs');
const nodemailer = require("nodemailer");

const { Wallets, Contract, Gateway, DefaultEventHandlerStrategies, 
    DefaultQueryHandlerStrategies } = require('fabric-network');

// Interfaces
import { Client } from '../interfaces/client';

export class ChainSCANClient {
    private contract1: typeof Contract;
    private contract2: typeof Contract;
    private gateway: typeof Gateway;
    private transporter: any;

    constructor(private client: Client, private sender: string) {}

    // Generic
    async connect(local :boolean =true) {
        const ccpPath = path.join(__dirname, '..', 'ccp', `connection-${this.client.org}.json`);
        const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        const ccp = JSON.parse(ccpJSON);
    
        const walletPath = path.join(__dirname, '..', 'wallet');
        const wallet =  await Wallets.newFileSystemWallet(walletPath);
    
        this.gateway = new Gateway();
        await this.gateway.connect(ccp, { wallet, identity: this.client.user, discovery: { enabled: true, asLocalhost: local },
                eventHandlerOptions: { endorseTimeout: 300, commitTimeout: 300, strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX },
                queryHandlerOptions: { timeout: 150, strategy: DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE }});
        const network = await this.gateway.getNetwork(this.client.channel);
        this.contract1 = await network.getContract(this.client.contract1);
        this.contract2 = await network.getContract(this.client.contract2);
    }

    async disconnect() {
        await this.gateway.disconnect();
    }

    setUpMail(password:string) {
        // To use Gmail, first enable OAuth to the account
        this.transporter = nodemailer.createTransport({
            port: 465,
            host: 'smtp.gmail.com',
            auth: {
              user: this.sender,
              pass: password
            },
            secure: true
        });
    }

    async listen() {
        await this.contract1.addContractListener(async (event:any) => {
            if (event.eventName === 'chainscan-event') {
                const chainscanEvent = JSON.parse(event.payload.toString('utf8'));
                const aid = chainscanEvent.aid;
                let res = await this.contract2.evaluateTransaction('getCurrentAssetOwner', JSON.stringify({ aid }))
                const oid = JSON.parse(res.toString('utf8')).owner;
                res = await this.contract2.evaluateTransaction('getOwnerEmailContact', JSON.stringify({ oid }))
                const email = JSON.parse(res.toString('utf8')).email;
                const mailOptions = {
                    from: this.sender,
                    to: email,
                    subject: `Notification for Asset ${aid}: ${chainscanEvent.event.title}`,
                    text: `Asset Type: ${chainscanEvent.event.asset_type}\nDanger Level: ${chainscanEvent.event.danger_level}\n${chainscanEvent.event.details}`
                };
                console.log(mailOptions)
                this.transporter.sendMail(mailOptions, (error:any, info:any) => {
                    if (error) console.log(error);
                    else console.log(`Notification to ${oid} successfully sent`);
                })
            }
        })
    }
}
