const n = require("numbro");
//const Terminator = require('./terminator');

/**
 * Number equivalent to percent
 *
 * Для DOGE цікаві значення:
 * IMPULSE_DOWN = 0.02
 *
 * @type {number}
 */
//const PRICE_NOISE = 0.2; // 0.002 * 100 = 0.2%

/**
 * Number equivalent of percent of price falling
 *
 * SHIB:
 * IMPULSE_DOWN = [-0.015, -0.02]
 * PRICE_RISE = 0.01
 *
 * DOGE:
 * IMPULSE_DOWN = [-0.008, -0.025]
 * PRICE_RISE = 0.005
 *
 * BTC:
 * IMPULSE_DOWN = [-0.006, -0.017]
 * PRICE_RISE = 0.004
 *
 * ETH:
 * IMPULSE_DOWN = [-0.006, -0.1]
 * PRICE_RISE = 0.003
 *
 */
// Percent of price decreasing
//const IMPULSE_DOWN = [-0.015, -0.02]; // -0.02 * 100 = -2%
////const IMPULSE_DOWN = [-1.5, -2]; // -2%

// Percent of price rising
//const PRICE_RISE = 0.01; // 0.005 * 100 = 0.5%
//const PRICE_RISE = 1; // 1%

class Analyzer {

  constructor(balance, terminator) {
    this.balance = balance;
    this.terminator = terminator;
    this.impulse = null;
    this.impulseBought = null;
    this.lowest = 0;
  }

  get impulseRangePrt() {
    return this.balance.options.impulse;
  }

  get priceNoisePrt() {
    return this.balance.options.price_noise;
  }

  get priceRisePrt() {
    return this.balance.options.price_rise;
  }

  /**
   * To find the percentage of a number between two numbers,
   * divide one number with the other and then multiply the result by 100.
   *
   * @see https://www.cuemath.com/questions/how-to-find-percentage-of-a-number-between-two-numbers/
   * @param num1
   * @param num2
   */
  percentageOfNumber(num1, num2) {
    return (num1 / num2) * 100; // (2/10)×100 = 20%
  }

  /**
   * (New Value – Old value)/Old value
   *
   * @param oldValue
   * @param newValue
   * @returns {number}
   */
  percentageDiff(oldValue, newValue) {
    return ((newValue - oldValue) / oldValue) * 100; // (3-2)/2*100 = 50%
  }

  /**
   * @see https://stackoverflow.com/a/3224854/1335142
   *
   * @param milliseconds1
   * @param milliseconds2
   * @returns {number}
   */
  daysDiff(milliseconds1, milliseconds2) {
    let date1 = new Date(milliseconds1);
    let date2 = new Date(milliseconds2);

    let diffTime = Math.abs(date2 - date1); // milliseconds
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  between(number, range) {
    let min = Math.min.apply(Math, range);
    let max = Math.max.apply(Math, range);
    return min <= number && number <= max;
  };

  /**
   * Get range of periods for the last $minutes
   *
   * @param lookback
   * @param minutes
   */
  lookbackRangeFor(lookback, minutes) {
    //let minutes = 30;
    let closes = [];
    for (let i = 0; i < minutes && i < lookback.length; i++) {
      closes.push(lookback[i].close);
    }

    return closes;
  }

  async actualizeBalance(selector) {
    let trades = await this.terminator.getDeferredTrades(selector);
    for (const trade of trades) {
      let total = n(trade.close).multiply(trade.size);
      this.balance.asset = n(this.balance.asset).add(trade.size).value();
      this.balance.deposit = this.balance.deposit - n(total).add(this.balance.computeFee(total)).value();
    }
  }

  isSmallImpulseDown(lookback) {
    let mediumCloses = this.lookbackRangeFor(lookback, 60);

    let mediumMin = Math.min(...mediumCloses);
    let mediumMax = Math.max(...mediumCloses);

    // Not more than 50% of max impulse down for the last hour | Increase max impulse down at 50%
    //let mediumImpulsePct = (Math.min(...IMPULSE_DOWN) * (1 + 0.5)) * 100; // @link http://zno.academia.in.ua/mod/book/tool/print/index.php?id=3010
    let mediumImpulsePct = (Math.min(...this.impulseRangePrt) * (1 + 0.5)) * 100; // @link http://zno.academia.in.ua/mod/book/tool/print/index.php?id=3010

    //return ((mediumMin - mediumMax) / mediumMax >= mediumImpulse);
    return this.percentageDiff(mediumMax, mediumMin) >= mediumImpulsePct;
  }

  isMiddleImpulseDown(s) {
    //let mediumCloses = this.lookbackRangeFor(s.lookback, 60);
    let periods = (s.options.timeframe_periods / parseFloat(s.options.period)) * 2;
    let mediumCloses = this.lookbackRangeFor(s.lookback, periods);

    let mediumMin = Math.min(...mediumCloses);
    let mediumMax = Math.max(...mediumCloses);

    // Not more than 50% of max impulse down for the last hour | Increase max impulse down at 50%
    //let mediumImpulsePct = (Math.min(...IMPULSE_DOWN) * (1 + 0.5)) * 100; // @link http://zno.academia.in.ua/mod/book/tool/print/index.php?id=3010
    let mediumImpulsePct = (Math.min(...this.impulseRangePrt) * (1 + 0.5)) * 100; // @link http://zno.academia.in.ua/mod/book/tool/print/index.php?id=3010

    // Here we have negative numbers, that's why the comparison sign is turned over
    return this.percentageDiff(mediumMax, mediumMin) <= mediumImpulsePct;
  }

  /**
   * If the latest purchase (trade) in the stack is with type 'buy' get it
   */
  /*getLatestPurchase(s) {
    return s.my_trades[s.my_trades.length - 1] && s.my_trades[s.my_trades.length - 1].type === 'buy'
      ? s.my_trades[s.my_trades.length - 1]
      : false;
  }*/

  detectImpulseDown(s) {
    if (this.impulse) {
      // Currently, we are in impulse down phase.
      // Determine if the falling down is continuing and don't bother about the short rising.

      // Get and check if the latest trade is type of 'buy'
      //let lastBuy = this.getLatestPurchase(s);

      //let rising = ((s.period.close - this.impulse.lowest.close) / this.impulse.lowest.close) > PRICE_NOISE; // 0.002 * 100 = 0.2%
      //let rising = this.percentageDiff(this.impulse.lowest.close, s.period.close) > PRICE_NOISE; // 0.2%
      let rising = this.percentageDiff(this.impulse.lowest.close, s.period.close) > this.priceNoisePrt; // 0.2%
      // (New Value – Old value)/Old value
      // !this.impulse.bought потрібно винести у if вище, але якщо це зробити чомусь починається дублювання "BUY at price..."

      if (this.impulse.lowest.close > s.period.close) {
        // Remember the impulse period for the next checking.
        this.impulse.lowest = {...s.period};
      //} else if (!this.impulseBought && rising && this.isSmallImpulseDown(s.lookback)) {
      } else if (!this.impulseBought && rising /*&& this.isSmallImpulseDown(s.lookback)*/) {
        //if (rising && this.isSmallImpulseDown(s.lookback)/* && ![0.1739, 0.174, 0.1904, 0.1793, 0.00004492, 0.00004012, 0.0000401].includes(this.impulse.lowest.close)*/) {

        // Impulse finished
        this.impulseBought = {...s.period};

        // Get number of coins to buy
        this.impulseBought.size = this.balance.getSizeOfCoinsToBuy(s.period.close, this.getPercentToBuy());
        this.impulseBought.selector = s.options.selector.normalized;
        //this.logToBuy(s);

        // ImpulseDown detected, time to buy.
        return true;

      } else if (this.impulseBought
        //&& this.percentageDiff(this.impulseBought.close, this.impulse.lowest.close) < Math.min(...IMPULSE_DOWN)
        && this.percentageDiff(this.impulseBought.close, this.impulse.lowest.close) < Math.min(...this.impulseRangePrt)
        //&& this.percentageDiff(this.impulse.lowest.close, s.period.close) > PRICE_NOISE
        && this.percentageDiff(this.impulse.lowest.close, s.period.close) > this.priceNoisePrt
        //&& ((s.period.close - this.impulse.lowest.close) / this.impulse.lowest.close) > PRICE_NOISE
      ) {
        // The first condition determines if we have several _deferred ImpulseDown.
        // The second condition determines if we certainly have a new ImpulseDown. It means
        // the difference between the last purchase and the last ImpulseDown must be more than lower negative value in IMPULSE_DOWN.
        // Or if simplify we must not be in the same price range as the last purchase.
        // The third conditions determines if price has been starting recovering.

        this.terminator.addPeriod({...this.impulseBought});
        // 2nd or 3rd or etc. Impulse finished
        this.impulseBought = {...s.period};

        // Get number of coins to buy
        this.impulseBought.size = this.balance.getSizeOfCoinsToBuy(s.period.close, this.getPercentToBuy());
        this.impulseBought.selector = s.options.selector.normalized;

        //this.logToBuy(s, 2);

        // ImpulseDown detected, time to buy.
        return true;

      //} else if (this.impulseBought && this.between((s.period.close - s.period.max) / s.period.max, IMPULSE_DOWN)
      //} else if (this.impulseBought && this.between(this.percentageDiff(s.period.max, s.period.close), IMPULSE_DOWN)
      } else if (this.impulseBought && this.between(this.percentageDiff(s.period.max, s.period.close), this.impulseRangePrt)
      ) {
        // Checking if a new ImpulseDown has happened immediately after the last one,
        // and we haven't been able to sell the latest purchase.

        // Remember the new Impulse for the next checking.
        this.impulse = { lowest: {...s.period} };
      } else if (this.isMiddleImpulseDown(s)) {
        // We detect the high ImpulseDown for the last hour.
        // Remember the new Impulse for the next checking.
        this.impulse = { lowest: {...s.period} };
      }

      // We're still in the falling down phase, wait the next period

    //} else if (this.between((s.period.close - s.period.max) / s.period.max, IMPULSE_DOWN)) { // -0.02 * 100 = -2%
    //} else if (this.between(this.percentageDiff(s.period.max, s.period.close), IMPULSE_DOWN)) { // -0.02 * 100 = -2%
    } else if (this.between(this.percentageDiff(s.period.max, s.period.close), this.impulseRangePrt)) { // -0.02 * 100 = -2%
      // (New Value – Old value)/Old value
      // Impulse down detected.
      // Wait the next period to understand current trend and determine if we should buy or wait yet.
      // let impulse = (s.period.close - s.period.max) / s.period.max)

      // Remember impulse period for the next checking.
      this.impulse = { lowest: {...s.period} };
    }

    return false;
  }

  async logToBuy(s) {
    let latestTrades = [];
    for (let i = s.my_trades.length - 1; i >= 0; i--) {
      let prevTrade = s.my_trades[i];
      if ('buy' === prevTrade.type) {
        latestTrades.push(prevTrade);
      } else {
        break;
      }
    }

    //let deferredTrades = await this.terminator.getDeferredTrades(s.options.selector.normalized);
    //let numberOfImpulse = deferredTrades.length ? deferredTrades.length + 1 : 1;
    let numberOfImpulse = latestTrades.length ? latestTrades.length + 1 : 1;

    let risingPercent = this.percentageDiff(s.period.min, s.period.close);
    let impulseDown = ((this.impulse.lowest.close - s.period.max) / s.period.max);
    //console.log(`\nBROUGHT: ${this.impulse.bought.close} | BOOL: ${this.impulse.bought}. We mustn't come here twice`);
    console.log(`\nBUY #${numberOfImpulse} at price: ${s.period.close} | LOW: ${this.impulse.lowest.close} | MAX: ${s.period.max} | ImpulseDown: ${(impulseDown).toFixed(3)} | ImpulseDown %: ${(impulseDown * 100).toFixed(2)}% | BUY AT: ${new Date(s.period.close_time).toISOString()}`);
    console.log(`CLOSE: ${s.period.close} | MIN: ${s.period.min} | MAX: ${s.period.max} | LOW: ${s.period.low} | HIGH: ${s.period.high}`);
    console.log(`RISING %: ${risingPercent.toFixed(2)} | $: ${this.balance.deposit} | COINS: ${this.balance.asset}`);
  }

  canBuy(s) {
    // Do not buy anything in preroll period
    if (s.in_preroll) {
      return false;
    }

    // Do not buy if a currency is exhausted
    if (!this.between(this.getPercentToBuy(), [0, 100])) {
      return false
    }

    if (this.detectImpulseDown(s)) {
      //this.getPercentToBuy(s);
      return true;
    }
  }

  logToSell(impulse, s) {
    let risingPercent = this.percentageDiff(impulse.close, s.period.close);

    this.lowest = (this.lowest == 0 || this.lowest > this.balance.deposit) ? this.balance.deposit : this.lowest;
    let profit = ((s.period.close - impulse.close) / impulse.close);
    console.log(`\nSOLD at price: ${s.period.close} | BOUGHT: ${impulse.close} | Profit: ${(profit).toFixed(4)} | Profit %: ${(profit * 100).toFixed(2)}% | SELL AT:${new Date(s.period.close_time).toISOString()}`);
    console.log(`CLOSE: ${s.period.close} | MIN: ${s.period.min} | MAX: ${s.period.max} | LOW: ${s.period.low} | HIGH: ${s.period.high}`);
    console.log(`RISING %: ${risingPercent.toFixed(2)} | $: ${this.balance.deposit} | COINS: ${this.balance.asset} | LOWEST: ${this.lowest}`);
  }

  canSell(s) {
    if (s.in_preroll) {
      return false;
    }
    // Impulse down has been detected and we bought coins.
    // As the result the latest trade in the stack is type of 'buy'
    //let lastBuy = this.getLatestPurchase(s);

    if (this.impulseBought/* && this.weAlreadyBuy*/) {
      // Sell coins if the price increases to 0.5% from the lowest
      // (New Value – Old value)/Old value | @link https://www.got-it.ai/solutions/excel-chat/excel-tutorial/excel-difference-between-columns/how-to-find-percentage-difference-between-two-numbers-in-excel
      //if (((s.period.close - this.impulseBought.close) / this.impulseBought.close) > PRICE_RISE) { // 0.005 * 100 = 0.5%
      //if (this.percentageDiff(this.impulseBought.close, s.period.close) > PRICE_RISE) { // 0.005 * 100 = 0.5%
      if (this.percentageDiff(this.impulseBought.close, s.period.close) > this.priceRisePrt) { // 0.005 * 100 = 0.5%
        this.impulse = null;
        this.impulseBought = null;

        return true;
      }
    }

    return false;
  }

  async canSellDeferred(s) {
    return await this.getSellDeferred(s);
  }

  async getSellDeferred(s) {
    if (s.in_preroll) {
      return false;
    }

    let deferred = null;
    //let trades = this.terminator.getDeferredTrades(s.my_trades);
    let trades = await this.terminator.getDeferredTrades(s.options.selector.normalized);
    for (const trade of trades) {
      // @todo Match fields in trade and s.period
      let pctDiff = this.percentageDiff(trade.close, s.period.close);
      let daysDiff = this.daysDiff(trade.close_time, s.period.close_time);

      switch (true) {
        case ((daysDiff <= 7) && pctDiff >= 0.5): // difference 7 days, price increased up to 0.5%
        case ((daysDiff <= (7 * 2)) && pctDiff >= 1): // difference 2 weeks, price increased up to 1%
        case ((daysDiff <= (7 * 48)) && pctDiff >= 5): // difference 48 weeks, price increased up to 15%
        case ((daysDiff >= (7 * 48)) && pctDiff >= 10): // difference 48+ weeks, price increased up to 20%
          deferred = trade;
          break;
      }

      // Stop further looping, because we can work only with one trade per time
      if (deferred) {
        break;
      }
    }

    return deferred;
  }

  getPercentToBuy() {
    // @todo: Get fixed value from options
    //let fixed = 50; // every time buy at the same price 50$
    let fixed = this.balance.options.fixed_size; // every time buy at the same price 50$
    return this.percentageOfNumber(fixed, this.balance.deposit);
  }

  getPercentToSell(period) {
    //return this.percentageOfNumber(period.size - ((period.size / 100) * 0.1), this.balance.asset);
    //return this.percentageOfNumber(period.size - this.balance.computeFee(period.size), this.balance.asset);
    return this.percentageOfNumber(period.size, this.balance.asset);
  }

}

module.exports = Analyzer;
