# ChainSCAN
This repository contains the components of ChainSCAN, a fully decentralized blockchain-based supply chain management system, that manages, regulates and records activities in food supply chain. ChainSCAN is formed for the collaboration of 4 blockchain organizations known as _producer_, _retailer_, _consumer_ and _transportation_. Furthermore, the application functionality is divided into 4 smart contracts:
* **Asset contract**: manages and supports every activity related to physical assets (i.e., create asset, transfer ownership of asset, etc.)
* **Trade contract**: supports and tracks trade events for each asset. The act of trading includes moving the ownership of assets from one owner to another. 
* **Transport contract**: regulate and manage asset shipment while providing package tracking information.
* **Ownership contract**: maintains the records of ownership for existing assets and generates new owners into ChainSCAN.
<p align="center">
  <img width="460" height="350" src="./chainscan_overview.png">
</p>

## Getting Started
1. Install the following software and packages:
    - NodeJS & NPM.
1. Clone and deploy [Blockchain_Manager](https://github.com/jacastillo8/Blockchain_Manager) tool.
1. Move all 4 smart contract folders to `Blockchain_Manager/blockchain_base/chaincode` so that the smart contracts can be properly instantiated in the blockchain.
1. Load collection `postman_collection_chainscan` into Postman.
    - Register ChainSCAN blockchain (`Register`), which includes 4 organizations denoted as Producer, Retailer, Transport and Consumer.
    - Build ChainSCAN blockchain (`Build`). Large blockchains may require larger times to deploy, thus, to avoid sending multiple build requests while waiting, just cancel the request after sending it. The blockchain will continue to deploy in the background. 
1. Navigate to `chainscan_notification` folder and install node dependencies. The notification system is used to automatically send email notifications to users affected by ChainSCAN events (i.e., salmonella infections to specific assets, etc.). 
    ```bash
    cd chainscan_notification
    npm install
    ```
1. You are now ready to interact with ChainSCAN.

### NPM commands to deploy ChainSCAN notification system
```bash
# To run ChainSCAN notification system
npm run getTestClient       # Queries blockchain manager to download and store the profile and wallet of a blockchain user
                            # Used after blockchain and contracts have been deployed
npm start                   # Starts ChainSCAN notification system
```

## Simple routine of ChainSCAN using Postman
1. Use `newProducer` to generate a new _owner_ in ChainSCAN. This specific owner has dummy information to simulate a producer.
    - Get the contact email address by using `getOwnerEmailContact` (only available to producer and retailer users).
1. Similarly, use `newRetailer` to generate a new retailer for ChainSCAN.
1. To generate a new asset use `newAsset`.
    - You can query the asset information by using `getAsset`.
1. Move the ownership of an asset generating `newTradeOrder`.
    - You can query the new trade order by using `getTradeOrder`.
1. Complete the trade by running `transferAsset`. This effectively move the ownership of the asset from owner A (producer) to owner B (retailer) and generates a new shipping label.
    - You can observe the change in ownership by using `getCurrentAssetOwner` and `getHistoricalAssetOwnership`.
1. To interact with shipping labels, the transport organization is able to accept the package by using `processPackageLabel`. This makes the transport organization responsible of the asset as it is now in one of the transportation vehicles (i.e., truck).
1. While on transit, the transportation vehicle is able to update the location of the package by using `updatePackageLabel`. This can be used multiple times depending on the update frequency desired. 
    - At any point in time, you can query the location of the package by selecting `getPackageLatest` or `getPackageHistory`.
1. Finally, once the package has reached its new destination, the transport organization terminates the shipping label with `terminatePackageLabel`.
* If abnormalities are detected for a given asset, the producer or retailer organization can generate a new event with `newAssetEvent`. This automatically trigger the notification system to collect the contact information of the current owner of the asset and forwards the event through email. 
    - You can also query the event from the ledger using `getAssetEvent`.