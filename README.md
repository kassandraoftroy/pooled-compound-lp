# pooled-compound-lp
Example contract suite that combines Token Bonding Curves, Compound Finance Liquidity Pools, and Uniswap/Compound governance paradimgs to create DAO Hedge Funds and other interesting treasury or project funding structures with many possible use cases.

The simplest use case that is simulated in the tests is a DAO Hedge Fund or investment fund that is managed by a community of token holders. To mint DAO tokens, participants deposit collateral which is subsequently lent to compound. From there token holders use the standard blockchain governance paradigms (forked from [Uniswap](https://github.com/Uniswap/governance)) to securely and democratically manage the DAOs position. Because all the collateral used to mint tokens is lent to compound it earns interest (which the DAO can withdraw and allocate). Further, since the DAO is a lender on Compound, the community has the ability to short or long other cryptos in the Compound market through simple governance operations. One potentially attractive aspect of this scheme is that the COMP governance token accrued from Compound Activity would also be managed democratically by this DAO giving it more of a say in the evolution of the Compound.Fininace protocol.

There might be a number of other projects and ideas to apply this funding and governance structure to, beyond just a Hedge Fund DAO. The same model can vary in a number of ways, and one of the most important properties is whether or not Compound Borrowing is possible. If it's not DAO participant collateral is never at risk (though the price still fluctuates with supply, as on any bonding curve, the collateral deposited will never be risked and only the interest can be extracted by the DAO and arbitrarily invested/governed over as the DAO sees fit).

# test

1. clone this repo

2. `yarn install`

3. `touch .env`

4. `vi .env`

5. `ALCHEMY_ID=<your alchemy api key>` (add into .env file)

6. `npx hardhat test`
