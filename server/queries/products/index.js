// Keep product SQL grouped by feature, but export it from one place for routes
// and benchmark scripts.

module.exports = {
  ...require('./search.sql'),
  ...require('./deals.sql'),
  ...require('./browse.sql'),
  ...require('./detail.sql'),
  ...require('./trending.sql'),
  ...require('./value.sql')
};
