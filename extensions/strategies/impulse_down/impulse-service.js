const DocService = require('./doc-service');
//const objectifySelector = require('../../../lib/objectify-selector');

class ImpulseService extends DocService {

  get mnemo() {
    // Singular name of collection
    return 'impulse';
  }

  get cnemo() {
    // Plural name of collection
    return this.mnemo + 's';
  }

  async findDeferredImpulses(selector) {
    //this.mongo.collection('impulses').createIndex({selector: 1, sold: 1, time: 1});
    //let impulses = this.getCollection();

    let deferred = await this.mongo.collection(this.cnemo).find({ selector: selector, sold: false }).toArray();

    return deferred;
  }
}

module.exports = ImpulseService;
