import XianWalletUtils from "./js/xian-dapp-utils";

export default class WalletUtilService {
    constructor() {
        console.log("CONSTRUCTOR CALLED")
        XianWalletUtils.init('https://testnet.xian.org');
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