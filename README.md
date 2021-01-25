# continuous-token-lending-treasury
example of a continuous token bonded to DAI that is lent to Compound (cDAI), the interest accrued is only accesible by the 'owner' which can be a simple EOA or could be extended into a Treasury smart contract where the spending of accrued interest from the bonded token is governed over (e.g. a DAO where the token holders can vote to allocate the interest).

# usage

clone repo

yarn install

npx hardhat test
