// import {chainInfo} from './coinbase/nodeConfig'
import {chainInfo} from './chainConfig'

import {getNetwork, getInitBridgeChain} from './getUrlParams'
 
interface ConFig {
  [key: string]: any
}

const ENV_NODE_CONFIG = 'ENV_NODE_CONFIG'
// const LOCALCONFIG = localStorage.getItem(ENV_NODE_CONFIG)
const INIT_NODE = '56'
const ENV = getNetwork(ENV_NODE_CONFIG, INIT_NODE)
const netConfig:ConFig = chainInfo[ENV] ? chainInfo[ENV] : chainInfo[INIT_NODE]

const INITBRIDGE = getInitBridgeChain(netConfig.bridgeInitChain, netConfig.bridgeInitToken)

const config: ConFig = {
  ...netConfig,
  ...INITBRIDGE,
  ENV_NODE_CONFIG,
  chainInfo,
  localDataDeadline: 1617781347004,
  getBaseCoin (value:any, type: number) {
    if (value && value === 'BASECURRENCY') {
      if (type) {
        return netConfig.name
      } else {
        return netConfig.symbol
      }
    } else if (value && value === 'WETH') {
      return 'W' + netConfig.symbol
    } else {
      return value
    }
  },
  getCurBridgeConfigInfo (chainID:any) {
    let envConfig:ConFig = {
      bridgeConfigToken: '0xf27ee99622c3c9b264583dacb2cce056e194494f',
      bridgeInitDataChain: '56',
    }
    if (chainID && chainInfo[chainID].type === 'test') {
      envConfig = {
        bridgeConfigToken: '0x826Ee16b4B401E84c76b48a2A81545cBb994A995',
        bridgeInitDataChain: '256',
      }
    }
    return envConfig
  },
  getCurChainInfo (chainID:any) {
    if (chainID && chainInfo[chainID]) {
      return chainInfo[chainID]
    } else {
      return netConfig
    }
  }
}
export default config
