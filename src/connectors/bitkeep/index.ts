import { AbstractConnectorArguments, ConnectorUpdate } from "@web3-react/types";
import { AbstractConnector } from "@web3-react/abstract-connector";
import warning from "tiny-warning";

// import { SendReturnResult, SendReturn, Send, SendOld } from "./types";
export type SendReturnResult = { result: any }
export type SendReturn = any

export type Send = (method: string, params?: any[]) => Promise<SendReturnResult | SendReturn>
export type SendOld = ({ method }: { method: string }) => Promise<SendReturnResult | SendReturn>

function parseSendReturn(sendReturn: SendReturnResult | SendReturn): any {
  return sendReturn.hasOwnProperty("result") ? sendReturn.result : sendReturn;
}

export class NoBitKeepProviderError extends Error {
  public constructor() {
    super();
    this.name = this?.constructor?.name ?? '';
    this.message = "No BitKeep provider was found on window.bitkeep.";
  }
}

export class UserRejectedRequestError extends Error {
  public constructor() {
    super();
    this.name = this?.constructor?.name ?? '';
    this.message = "The user rejected the request.";
  }
}

export class BitKeepConnector extends AbstractConnector {
  constructor(kwargs: AbstractConnectorArguments) {
    super(kwargs);

    this.handleNetworkChanged = this.handleNetworkChanged.bind(this);
    this.handleChainChanged = this.handleChainChanged.bind(this);
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  private handleChainChanged(chainId: string | number): void {
    if (__DEV__) {
      console.log("Handling 'chainChanged' event with payload", chainId);
    }
    this.emitUpdate({ chainId, provider: window.bitkeep.ethereum });
  }

  private handleAccountsChanged(accounts: string[]): void {
    if (__DEV__) {
      console.log("Handling 'accountsChanged' event with payload", accounts);
    }
    if (accounts.length === 0) {
      this.emitDeactivate();
    } else {
      this.emitUpdate({ account: accounts[0] });
    }
  }

  private handleClose(code: number, reason: string): void {
    if (__DEV__) {
      console.log("Handling 'close' event with payload", code, reason);
    }
    this.emitDeactivate();
  }

  private handleNetworkChanged(networkId: string | number): void {
    if (__DEV__) {
      console.log("Handling 'networkChanged' event with payload", networkId);
    }
    this.emitUpdate({ chainId: networkId, provider: window.bitkeep.ethereum });
  }

  public async activate(): Promise<ConnectorUpdate> {
    if (!window?.bitkeep?.ethereum) {
      throw new NoBitKeepProviderError();
    }

    if (window.bitkeep.ethereum.on) {
      window?.bitkeep?.ethereum.on("chainChanged", this.handleChainChanged);
      window?.bitkeep?.ethereum.on("accountsChanged", this.handleAccountsChanged);
      window?.bitkeep?.ethereum.on("close", this.handleClose);
      window?.bitkeep?.ethereum.on("networkChanged", this.handleNetworkChanged);
    }

    if ((window?.bitkeep?.ethereum as any).isMetaMask) {
      (window?.bitkeep?.ethereum as any).autoRefreshOnNetworkChange = false;
    }

    // try to activate + get account via eth_requestAccounts
    let account;
    try {
      account = await (window?.bitkeep?.ethereum.send as Send)(
        "eth_requestAccounts"
      ).then((sendReturn) => parseSendReturn(sendReturn)[0]);
    } catch (error) {
      if ((error as any).code === 4001) {
        throw new UserRejectedRequestError();
      }
      warning(
        false,
        "eth_requestAccounts was unsuccessful, falling back to enable"
      );
    }

    // if unsuccessful, try enable
    if (!account) {
      // if enable is successful but doesn't return accounts, fall back to getAccount (not happy i have to do this...)
      account = await window?.bitkeep?.ethereum.enable().then(
        (sendReturn:any) => sendReturn && parseSendReturn(sendReturn)[0]
      );
    }

    return { provider: window?.bitkeep?.ethereum, ...(account ? { account } : {}) };
  }

  public async getProvider(): Promise<any> {
    return window?.bitkeep?.ethereum;
  }

  public async getChainId(): Promise<number | string> {
    if (!window?.bitkeep?.ethereum) {
      throw new NoBitKeepProviderError();
    }

    let chainId;
    try {
      chainId = await (window?.bitkeep?.ethereum.send as Send)("eth_chainId").then(
        parseSendReturn
      );
    } catch {
      warning(
        false,
        "eth_chainId was unsuccessful, falling back to net_version"
      );
    }

    if (!chainId) {
      try {
        // window?.bitkeep?.ethereum.send('net_version').then((res:any) => {
        //   console.log(res)
        // })
        // chainId = await (window?.bitkeep?.ethereum.send as Send)("net_version").then(
        //   parseSendReturn
        // );
        chainId = await window?.bitkeep?.ethereum.send('net_version')
      } catch {
        warning(
          false,
          "net_version was unsuccessful, falling back to net version v2"
        );
      }
    }

    if (!chainId) {
      try {
        // chainId = parseSendReturn(
        //   (window?.bitkeep?.ethereum.send as any)({ method: "net_version" })
        // );
        chainId = await window?.bitkeep?.ethereum.send('net_version')
      } catch {
        warning(
          false,
          "net_version v2 was unsuccessful, falling back to manual matches and static properties"
        );
      }
    }

    if (!chainId) {
      if ((window?.bitkeep?.ethereum as any).isDapper) {
        chainId = parseSendReturn(
          (window?.bitkeep?.ethereum as any).cachedResults.net_version
        );
      } else {
        chainId =
          (window?.bitkeep?.ethereum as any).chainId ||
          (window?.bitkeep?.ethereum as any).netVersion ||
          (window?.bitkeep?.ethereum as any).networkVersion ||
          (window?.bitkeep?.ethereum as any)._chainId;
      }
    }

    return chainId;
  }

  public async getAccount(): Promise<null | string> {
    if (!window?.bitkeep?.ethereum) {
      throw new NoBitKeepProviderError();
    }

    let account;
    try {
      // account = await (window?.bitkeep?.ethereum.send as Send)("eth_accounts").then(
      //   (sendReturn) => parseSendReturn(sendReturn)[0]
      // );
      account = await window?.bitkeep?.ethereum.send('eth_accounts')
    } catch {
      warning(false, "eth_accounts was unsuccessful, falling back to enable");
    }

    if (!account) {
      try {
        account = await window?.bitkeep?.ethereum.enable().then(
          (sendReturn:any) => parseSendReturn(sendReturn)[0]
        );
      } catch {
        warning(
          false,
          "enable was unsuccessful, falling back to eth_accounts v2"
        );
      }
    }

    if (!account) {
      account = parseSendReturn(
        (window?.bitkeep?.ethereum.send as SendOld)({ method: "eth_accounts" })
      )[0];
    }

    return account;
  }

  public deactivate() {
    if (window?.bitkeep?.ethereum && window?.bitkeep?.ethereum.removeListener) {
      window?.bitkeep?.ethereum.removeListener(
        "chainChanged",
        this.handleChainChanged
      );
      window?.bitkeep?.ethereum.removeListener(
        "accountsChanged",
        this.handleAccountsChanged
      );
      window?.bitkeep?.ethereum.removeListener("close", this.handleClose);
      window?.bitkeep?.ethereum.removeListener(
        "networkChanged",
        this.handleNetworkChanged
      );
    }
  }

  public async isAuthorized(): Promise<boolean> {
    if (!window?.bitkeep?.ethereum) {
      return false;
    }

    try {
      return await (window?.bitkeep?.ethereum.send as Send)("eth_accounts").then(
        (sendReturn) => {
          if (parseSendReturn(sendReturn).length > 0) {
            return true;
          } else {
            return false;
          }
        }
      );
    } catch {
      return false;
    }
  }
}
