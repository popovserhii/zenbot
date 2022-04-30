const DocService = require('./doc-service');

class OrderService extends DocService {
  get mnemo() {
    // Singular name of collection
    return 'order';
  }

  get cnemo() {
    // Plural name of collection
    return this.mnemo + 's';
  }
}

module.exports = OrderService;
