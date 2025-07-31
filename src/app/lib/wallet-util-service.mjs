import XianWalletUtils from "./js/xian-dapp-utils";

export default class WalletUtilService {
    constructor() {
        XianWalletUtils.init('https://node.xian.org');
    }
    static instance = null;
    static getInstance() {
        if (WalletUtilService.instance === null) {
            WalletUtilService.instance = new WalletUtilService();
        }
        return WalletUtilService.instance;
    }
    XianWalletUtils = XianWalletUtils
}