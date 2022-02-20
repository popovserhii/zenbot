const _ = require('lodash');

class Terminator {
  /**
   * @param ImpulseService impulseService
   */
  constructor(impulseService) {
    this._impulseService = impulseService;
    this._deferred = null;
  }

  /*get deferred() {
    if (null === this._deferred) {
      this._deferred = this._impulseService.findDeferredImpulses();
    }
  }*/

  async addPeriod(period) {
    period.sold = false
    period.close_datetime = new Date(period.close_time).toISOString();
    this._deferred.push(period);
    await this._impulseService.insert(period);

    return this;
  }

  updatePeriod(period, partial) {
    _.merge(period, partial);
    this._impulseService.update(partial, { _id: period._id });

    return this;
  }

  /**
   * Iterate through the history of the trades and find out bought trades
   * that took place two and more times before the selling.
   * That means that those trades are _deferred, and we should sell them when a good chance happen.
   *
   * For example, we need to filter out only 'buy' trades that marked with '+'
   *  buy
   *  sell
   *  buy+
   *  buy
   *  sell
   *  buy+
   *  buy+
   *  buy
   *  sell
   *
   * @param selector
   * @returns {Promise<null>}
   */
  async getDeferredTrades(selector) {
    if (null === this._deferred) {
      this._deferred = await this._impulseService.findDeferredImpulses(selector);
    }

    return this._deferred = this._deferred.filter((period, index) => {
      return period.selector === selector && period.sold === false;
    });
  }
}

module.exports = Terminator;
