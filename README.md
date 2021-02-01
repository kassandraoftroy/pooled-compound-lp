# pooled-compound-lp
Reserach on using bonding curves and the Compound Finance liquidity pools to create decentralized investment funds with arbitrary governance possibilities.

There are a number of potential use cases of such paradigms: the easiest and most natural to imagine are decentralized hedge funds where a DAO democratically manages taking short and long positions on different cryptos (borrowing off the collateral deposited to mint DAO tokens), and profits are distributed across the DAO token holders.

Another potential use case is to create a funding stream for projects without risking user deposited collateral at all. For instance an alternate funding model for a Decentralized Casino, one that takes no fee or rake on casino games but still turns a profit. This is possible by making the "chips" (the token used to play casino games) one of these bonded and invested tokens. The casino does not charge rake on games but makes money from the interest generated on any of the chips currently in circulation (being held for current or future use in casino games).

# test

1. clone this repo

2. `yarn install`

3. `touch .env`

4. `vi .env`

5. `ALCHEMY_ID=<your alchemy api key>` (add into .env file)

6. `npx hardhat test`
