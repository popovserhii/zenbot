const n = require("numbro");

class Balance {

  constructor(balance, options, fee) {
    this.balance = balance;
    this.options = options;
    this.assetIncrement = 0;
    this._fee = fee;
  }

  set currency(value) {
    this.balance.currency = value;

    return this;
  }

  get currency() {
    // Here we need to operate with real s.balance.currency
    return this.balance.currency;
  }

  set asset(value) {
    this.balance.asset = value;

    return this;
  }

  get asset() {
    return this.balance.asset;
  }

  get fee() {
    return this._fee;
  }

  isInit() {
    return !!this.balance;
  }

  init(balance, options, fee) {
    if (!this.isInit()) {
      this.balance = balance;
      this.options = options;
      this._fee = fee;

      //console.log('\nInit balance: ', this.balance);
    }

    return this;
  }

  computeFee(total) {
    let fee = this.fee;

    // Compute fees
    if (this.options.order_type === 'maker' && this.fee) {
      fee = n(total).multiply(this.fee / 100).value();
    } else if (this.options.order_type === 'taker' && this.fee) {
      fee = n(total).multiply(this.fee / 100).value();
    }
    // ((period.size / 100) * 0.1)

    return fee;
  }

  setAssetIncrement(value) {
    this.assetIncrement = value;

    return this;
  }

  sellFor(price, pct, s) {
    let so = this.options;
    let size = n(this.balance.asset).divide(100).multiply(pct).format(this.assetIncrement ? this.assetIncrement : '0.00000000');

    // Add estimated slippage to price
    if (so.order_type === 'maker') {
      price = n(price).subtract(n(price).multiply(so.avg_slippage_pct / 100));
    }

    let total = n(price).multiply(size);
    let fee = this.computeFee(total);

    if (isNaN(parseFloat(this.balance.asset))) {
      console.log('\n', this.balance, s);
    }

    // Update balance
    this.balance.asset = n(this.balance.asset).subtract(size).value();
    this.balance.currency = n(this.balance.currency).add(total).subtract(fee).value();
  }

  getSizeOfCoinsToBuy(price, buyPct, s) {
    let tradeBalance = n(this.balance.currency).divide(100).multiply(buyPct);
    let tradableBalance = n(this.balance.currency).divide(100 + this.fee).multiply(buyPct);
    //let expectedFee = n(tradeBalance).subtract(tradableBalance).format('0.00000000', Math.ceil); // round up as the exchange will too
    let expectedFee = n(tradeBalance).subtract(tradableBalance);

    //let size = (buyPct + this.fee < 100)
    //  ? n(tradableBalance).divide(price).format(this.assetIncrement ? this.assetIncrement : '0.00000000')
    //  : n(tradeBalance).subtract(expectedFee).divide(price).format(this.assetIncrement ? this.assetIncrement : '0.00000000');
    let size = (buyPct + this.fee < 100)
      ? n(tradableBalance).divide(price).format(this.assetIncrement ? this.assetIncrement : '0.00000000')
      : n(tradeBalance).subtract(expectedFee).divide(price).format(this.assetIncrement ? this.assetIncrement : '0.00000000');

    return size;
  }

  buyFor(price, buyPct, s) {
    //let tradeBalance = n(this.balance.currency).divide(100 + this.fee).multiply(buyPct);
    let tradeBalance = n(this.balance.currency).divide(100).multiply(buyPct);
    let size = this.getSizeOfCoinsToBuy(price, buyPct);


    if (isNaN(parseFloat(this.balance.asset))) {
      console.log('\n', this.balance);
    }

    this.balance.asset = n(this.balance.asset).add(size).value();
    this.balance.currency = n(this.balance.currency).subtract(tradeBalance).value();
  }
}

module.exports = Balance;
