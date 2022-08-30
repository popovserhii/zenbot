const _ = require('lodash');

class Terminator {
  /**
   * @param ImpulseService impulseService
   */
  constructor(impulseService) {
    this._impulseService = impulseService;
    this._deferred = null;
    this._marked = null;
  }

  /*get deferred() {
    if (null === this._deferred) {
      this._deferred = this._impulseService.findDeferredImpulses();
    }
  }*/

  get marked() {
    return this._marked;
  }

  /**
   * Mark period for sale and later in orderExecuted() change the status to "sold"
   * @param period
   */
  markPeriod(period) {
    this._marked = period;

    return this;
  }

  resetMarked() {
    this._marked = null;

    return this;
  }

  async addPeriod(period) {
    period.sold = false
    period.close_datetime = new Date(period.close_time).toISOString();

    await this._impulseService.insert(period);
    // It's important to have it after 'await', otherwise we can get stack with zombi orders in the database.
    this._deferred.unshift(period);

    return this;
  }

  async updatePeriod(period, partial) {
    let updated = new Date();
    partial.update_datetime = updated.toISOString();
    partial.update_time = updated.getTime();
    _.merge(period, partial);

    //await this._impulseService.update(partial, { order_id: period.order_id });
    await this._impulseService.update(partial, { _id: period._id });

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

    /*return this.getDeferredTradesFromMemory(selector).filter((period, index) => {
      return period.status === status;
    });*/
    return this.getDeferredTradesFromMemory(selector);
  }

  getDeferredTradesFromMemory(selector) {
    return this._deferred = this._deferred.filter((period, index) => {
      return period.selector === selector && period.sold === false;
    });
  }
}

module.exports = Terminator;
