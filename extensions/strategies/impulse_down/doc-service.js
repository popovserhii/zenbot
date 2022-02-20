class DocService {

  constructor(mongo) {
    if (DocService === this.constructor) {
      throw new Error("Abstract classes can't be instantiated.");
    }
    this.mongo = mongo;
  }

  get mnemo() {
    throw new Error("Getter 'mnemo()' must be implemented.");
  }

  get cnemo() {
    throw new Error("Getter 'cnemo()' must be implemented.");
  }

  /**
   * This code isn't a part of this service and should be initialized on the project bootstrap,
   * but for simplification I put it here.
   */
  async init(mongo) {
    if (!this.mongo) {
      this.mongo = mongo;
    }

    let counter = await this.mongo.collection('counters').findOne({ _id: this.mnemo + 'Id' });
    if (!counter) {
      await this.mongo.collection('counters').insertOne({
        _id: this.mnemo + 'Id',
        sequence: 0
      });
    }
  }
/*
  async init(mongo) {
    if (!this.mongo) {
      this.mongo = mongo;
    }

    this.mongo.collection('counters').findOne({ _id: this.mnemo + 'Id' }).then((counter) => {
      if (!counter) {
        this.mongo.collection('counters').insertOne({
          _id: this.mnemo + 'Id',
          sequence: 0
        }).catch((err) => {
          console.error(err);
        });
      }
    })
  }
*/

  getCounters() {
    return this.mongo.collection('counters');
  }

  getCollection() {
    //this.mongo.collection('impulses').createIndex({selector: 1, sold: 1, time: 1});
     return this.mongo.collection(this.cnemo);
  }

  /**
   * @see https://stackoverflow.com/questions/16209681/what-is-the-difference-between-save-and-insert-in-mongo-db#comment33024328_16209860
   *
   * @param doc
   * @returns {Promise<void>}
   */
  async insert(doc) {
    const collection = this.getCollection();

    let newId = await this.getNextSequence(this.mnemo);
    doc._id = doc._id ? doc._id : newId;

    return await collection.insertOne(doc);
  }

  /**
   *
   * @param doc Partial document to update
   * @param filter
   * @returns {Promise<OrderedBulkOperation|UnorderedBulkOperation|*>}
   */
  async update(doc, filter) {
    const collection = this.getCollection();

    // create a filter for a movie to update
    //const filter = { _id: 1 };

    // this option instructs the method to create a document if no documents match the filter
    const options = { upsert: true };

    // create a document that sets the plot of the movie
    const updateDoc = { $set: doc };

    return await collection.updateOne(filter, updateDoc, options);
  }

  /**
   * Autoincrement for collections.
   *
   * Create a getNextSequence function that accepts a name of the sequence.
   * The function uses the findOneAndUpdate() method to atomically increment the "sequence" value and return this new value.
   *
   * @see https://stackoverflow.com/a/24326067/1335142
   * @see https://web.archive.org/web/20151009224806/http://docs.mongodb.org/manual/tutorial/create-an-auto-incrementing-field/
   *
   * @param name Singular name of collection
   *
   * @returns {Promise<number|string|number|*>}
   */
  async getNextSequence(name) {
    let counter = await this.mongo.collection('counters').findOneAndUpdate(
      { _id: name + 'Id' },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, returnDocument: 'after' }
    );

    return counter.value.sequence;
  }
}

module.exports = DocService;
