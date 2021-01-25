# continuous-token-with-lending
Example of a continuous token bonded to DAI that is lent to Compound (cDAI). 

The interest accrued is only accesible by the token 'owner' which can be a simple EOA (as in this example) but can further be extended into a Treasury smart contract where the spending of accrued interest from the collateral bonded to the token is governed over. 

Imagine a DAO where the token holders can vote on proposals that allocate the interest to certain developers/accounts/projects by voting (or any other decentralized governance mechanisms). The idea is that the interest can be used to fund ventures that help to increase adoption/demand for the token

The bonding curve chosen is a simple linear Bancor curve, but any other curve can be chosen by altering the constructor arguments. Currently the bonding curve is fixed for the life of the contract (but making that subject to governance could be very interesting as well).

# usage

clone repo

yarn install

npx hardhat test
