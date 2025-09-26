
import XianWalletUtils from './js/xian-dapp-utils.js';

export default class WalletUtilService {
  static instance;

  constructor() {
    if (WalletUtilService.instance) {
      return WalletUtilService.instance;
    }
    this.XianWalletUtils = XianWalletUtils;
    WalletUtilService.instance = this;
  }

  static getInstance() {
    if (!WalletUtilService.instance) {
      new WalletUtilService();
    }
    return WalletUtilService.instance;
  }
}
