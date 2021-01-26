# continuous-token-with-lending
Example of a continuous token bonded to DAI which is subsequently lent to Compound (cDAI) enabling the bonded token's collateralized DAI to earn interest as opposed to simply sitting idle inside the token contract.

The continuous token implements the ERC20 interface i.e. it functions as any standard fungible token on ethereum. It may have arbitrary number of secondary markets but because it is bonded to DAI it always has guaranteed liquidity with that asset as well as automatic price discovery against it.

In this example the interest accrued is only accesible by the token's 'owner' which can be a simple EOA (extrenally owned account) or it can be granted to any arbitrary Treasury smart contract where the spending of accrued interest (and changes of ownership) are governed over. 

e.g. imagine a DAO where the token holders can vote on proposals that allocate the interest generated from the collateral to certain developers/projects/accounts by voting (or any other decentralized governance mechanisms). Token holders can still burn their tokens to redeem collateralized DAI at any time, cDAI is simply withdrawn from compound under the hood whenever any holder burns tokens for DAI. The idea here is that a community could use the interest to increase the demand/utility of their decentralized products.

The bonding curve chosen in this example is a simple linear (y=x) Bancor curve, but any other Bancor curve can easily be configured by altering the constructor arguments. Currently the bonding curve is fixed for the life of the contract (but making that subject to governance could be very interesting as well).

# usage

`clone repo`

`yarn install`

`touch .env`

`vi .env`

`ALCHEMY_ID=<your alchemy api key>` (add into .env file)

`npx hardhat test`
