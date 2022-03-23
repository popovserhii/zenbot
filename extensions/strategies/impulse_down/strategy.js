const z = require('zero-fill'),
  n = require('numbro'),
  _ = require('lodash'),
  Phenotypes = require('../../../lib/phenotype'),

  Analyzer = require('./analyzer'),
  Terminator = require('./terminator'),
  Balance = require('./balance'),
  OrderService = require('./order-service'),
  ImpulseService = require('./impulse-service')
;

let orderService = new OrderService();
let impulseService = new ImpulseService();
let balance = new Balance();
let terminator = new Terminator(impulseService);
let analyzer = new Analyzer(balance, terminator);

module.exports = {
  name: 'Impulse Down',

  description: 'Buy when the price has fallen #% in a given time frame  Sell when the price has risen #% in a given time frame.',

  /**
   * Licence: MIT Trade / use at your own risk! Reddit: king_fredo
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
   * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
   * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
   * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
   * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
   * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   */
  getOptions: async function (s) {

    console.log('Impulse Down strategy 2022-02-22 - GONNA MAKE U RICH BABY!')

    /* Universal */
    this.option('period', 'period length, same as --period_length', String, '1m')
    this.option('period_length', 'period length, same as --period', String, '1m')
    this.option('min_periods', 'min. history periods', Number, 400)
    //this.option('currency_capital', 'amount of start capital in currency', Number, 1000)
    this.option('deposit', 'amount of start capital in currency', Number, 1000)

    /* Strategy */
    //this.option('pct_sell', 'factor e.g 1.05 when price has risen 5% from min', Number, 1.05)
    //this.option('pct_buy', 'factor, e.g 0.95 when price has fallen 5% from max', Number, 0.95)
    //this.option('timeframe_periods', 'no. of lookback periods', Number, 30)
    this.option('fixed_size', 'buy/sell with fixed currency size', Number, 50)
    this.option('timeframe_periods', 'historical (lookback) period in mins the strategy to work with', Number, 30)
    this.option('impulse', 'percent of price decreasing', Array, [-2, -1.5])
    this.option('price_noise', 'ignore price increasing at percent after impulse down and before buying', Number, 0.2)
    this.option('price_rise', 'percent of price rising', Number, 1)
    this.option('port', 'API port', Number, 17365)

    s.conf.output.api.port = s.options.port;

    // The code below should be somewhere in DI, but we don't have DI at this moment
    //balance.init({ ...s.balance }, s.options, (s.exchange.makerFee || s.exchange.takerFee));
    balance.init({ currency: 0, asset: 0 }, s.options, (s.exchange.makerFee || s.exchange.takerFee));

    // Unrelated code should not have to wait. @see https://dev.to/christopherkade/the-dangers-of-async-await-3p5g
    await Promise.all([
      orderService.init(s.conf.db.mongo),
      impulseService.init(s.conf.db.mongo)
    ]);

    // Balance actualization is actual only in sim mode,
    // because in trade mode the balance synchronize automatically at extensions/exchanges/binance/exchange.js:112
    if (s.options.mode === 'sim') {
      balance.asset = 0;
      balance.currency = s.options.deposit;
      await analyzer.actualizeBalance(s.options.selector.normalized);
    }
  },

  /**
   * Calculates values of indicators for data just received using prev value of indicator / data .
   * ex calculating current ema using previous ema / previous data and current data.
   *
   * @param s
   */
  calculate: function (s) {
    // Initially set buy/sell timeout to zero
    if (typeof s.timeout_buy === 'undefined'){
      s.timeout_buy = 0
    }
    if (typeof s.timeout_sell === 'undefined'){
      s.timeout_sell = 0
    }
  },

  /**
   * Called each time there is a new trade. It's the right place to update indicators.
   */
  onCalculate: function (s) {},

  /**
   * onPeriod -> based on the indicator value calculated by calculate, issues buy/sell signals.
   *
   * Called at the end of each period. It's the right place to send 'buy' or 'sell' signals.
   *
   * @param s
   * @param cb
   */
  onPeriod: async function (s, cb) {
    // @todo determine periods automatically according to --period
    // if --period=5m then periods has to be 6
    // if --period=2m then periods has to be 15
    // if --period=1m then periods has to be 30
    //let periods = 30;
    let periods = s.options.timeframe_periods / parseFloat(s.options.period);
    let closes = analyzer.lookbackRangeFor(s.lookback, periods);

    //s.period.min = Math.min(...closes);
    //s.period.max = Math.max(...closes);

    s.period.min = closes[0];
    s.period.max = closes[0];

    for (let i = 1, len = closes.length; i < len; i++) {
      let v = closes[i];
      s.period.min = (v < s.period.min) ? v : s.period.min;
      s.period.max = (v > s.period.max) ? v : s.period.max;
    }

    // It's important to have actual balance here, because it syncs with original crypto exchanger,
    // otherwise we will get the wrong calculation here lib/engine.js:417
    if (s.options.mode === 'live') {
      balance.currency = s.balance.currency;
      balance.asset = s.balance.asset;
    }

    // CALCULATE BUY SELL TRIGGER
    let impulse = analyzer.impulseBought ? { ...analyzer.impulseBought } : null;

    // BUY && SELL
    s.signal = null;
    if (analyzer.canSell(s)) {
      // Sell Signal
      s.signal = 'sell';
      s.options.sell_pct = analyzer.getPercentToSell(impulse);
      //s.options.sell_pct = analyzer.getPercentToSell({size: 173});

      analyzer.balance.sellFor(s.period.close, s.options.sell_pct, s);
      analyzer.logToSell(impulse, s);

    } else if (await analyzer.canSellDeferred(s)) {
      let deferredImpulse = await analyzer.getSellDeferred(s);

      // Sell Signal
      s.signal = 'sell';
      s.options.sell_pct = analyzer.getPercentToSell(deferredImpulse);

      analyzer.balance.sellFor(s.period.close, s.options.sell_pct, s);
      analyzer.logToSell(deferredImpulse, s);
      analyzer.terminator.updatePeriod(deferredImpulse, { sold: true });
    } else if (analyzer.canBuy(s)) { // 0.18 <=  0.22 * 0.97
      // Buy Signal
      s.signal = 'buy';
      // Don't change s.balance.currency to any new value. Here we correct value in 'trade' mode
      s.options.buy_pct = analyzer.getPercentToBuy();

      analyzer.balance.buyFor(s.period.close, s.options.buy_pct, s);
      await analyzer.logToBuy(s);
    }

    cb();
  },

  /*orderExecuted: function (s, type, executeSignalCb) {
    if (!s.in_preroll) {

      //let db = s.conf.db.mongo;
      orderService.save(s.my_trades[s.my_trades.length - 1])
        .catch(e => {
          console.error(e);
        });

      executeSignalCb(type);
    }
  },*/

  /**
   * onReport used to display values in terminal for sim.
   *
   * Called each time the console is refreshed.
   * It must return an array, and each item in this array will be displayed in the console (after the RSI and before the balance).
   *
   * @see https://github.com/DeviaVir/zenbot/tree/unstable/docs#reading-the-console-output
   *
   * @param s
   * @returns {*[]}
   */
  onReport: function (s) {
    //return [];


    var cols = [];

    // About s.in_preroll:
    // At start, the methods calculate() and onPeriod() are called for a few historical, already past, periods.
    // It is required for feed previous values to indicators such as rsi and ma. s.in_preroll is set to true for these periods.
    // The number of historical period used can be defined in config with --min_periods.
    if (!s.in_preroll) {
      let color = 'grey'

      //   s.signal = 'sell'
      if (s.period.close >= s.period.min * s.options.pct_sell) {
        color = 'green'
      }

      cols.push(z(9, n(s.period.min * s.options.pct_sell).format('-0.0000'), ' ')[color])


      color = 'grey'
      // s.signal = 'buy'
      if (s.period.close <= s.period.max * s.options.pct_buy) {
        color = 'red'
      }
      cols.push(z(9, n(s.period.max * s.options.pct_buy).format('-0.0000'), ' ')[color])

    }

    //console.log('----------------');
    //console.log(cols);



    return cols
  },

  /**
   * Phenotype sets limit for various variables used in indicators. ex ema_short_period
   * Phenotypes are all the observable characteristics of an organism.
   */
  Phenotype: {
    // -- common
    period_length: Phenotypes.ListOption(['20s', '30s', '40s', '60s', '90s', '180s', '300s', '10m', '30m', '1h', '2h']),
    min_periods: Phenotypes.Range(1000, 1000),
    timeframe_periods: Phenotypes.Range(50, 700),
    //trail_pct_price: Phenotypes.RangeFactor(0.00, 0.75, 0.05),
    //pct_sell: Phenotypes.RangeFactor(1.00, 1.05, 0.001),
    //pct_buy: Phenotypes.RangeFactor(1.00, 0.95, 0.001),
  }
}
